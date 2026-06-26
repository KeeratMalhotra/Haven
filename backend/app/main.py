"""ChronAI Backend - FastAPI server with WebSocket chat and AI agents."""

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

import asyncio
import secrets
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware

from app.agents.base import AgentRegistry
from app.agents.orchestrator import OrchestratorAgent
from app.agents.planner import PlannerAgent
from app.agents.scheduler import SchedulerAgent
from app.agents.notification import NotificationAgent
from app.agents.voice import VoiceAgent
from app.agents.email import EmailAgent
from app.auth import verify_google_token
from app.config import settings
from app.db.firestore import init_firestore
from app.mcp.client import MCPClient
from app.scheduler.proactive import start_proactive_scheduler, stop_proactive_scheduler, run_nudge_check
from app.ws_manager import connection_manager

# Add shared package to path so we can import shared schemas
_shared_path = str(Path(__file__).resolve().parent.parent.parent / "shared")
if _shared_path not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from shared.schemas import WebSocketMessage, AgentResponse, MessageType, ResponseType


# Global MCP client instance
mcp_client: MCPClient | None = None

# Global proactive scheduler task
_scheduler_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle.

    Initializes MCP client, connects to MCP servers,
    registers all agents, and starts the proactive scheduler on startup.
    Cleans up on shutdown.
    """
    global mcp_client, _scheduler_task

    # Initialize Firestore
    init_firestore()

    # Initialize MCP client
    mcp_client = MCPClient()
    await mcp_client.start()

    # Connect to MCP servers (they run as subprocesses)
    try:
        await mcp_client.connect_server(
            name="google-calendar",
            command="python",
            args=[settings.MCP_CALENDAR_PATH],
        )
    except Exception:
        # Server will be connected when available
        pass

    try:
        await mcp_client.connect_server(
            name="google-tasks",
            command="python",
            args=[settings.MCP_TASKS_PATH],
        )
    except Exception:
        pass

    try:
        await mcp_client.connect_server(
            name="google-gmail",
            command="python",
            args=[settings.MCP_GMAIL_PATH],
        )
    except Exception:
        pass

    # Register agents
    OrchestratorAgent(mcp_client=mcp_client)
    PlannerAgent(mcp_client=mcp_client)
    SchedulerAgent(mcp_client=mcp_client)
    NotificationAgent(mcp_client=mcp_client)
    VoiceAgent(mcp_client=mcp_client)
    EmailAgent(mcp_client=mcp_client)

    # Start proactive scheduler
    _scheduler_task = start_proactive_scheduler(connection_manager)

    yield

    # Shutdown: stop proactive scheduler
    if _scheduler_task:
        stop_proactive_scheduler(_scheduler_task)

    # Shutdown: stop MCP servers
    if mcp_client:
        await mcp_client.stop()


app = FastAPI(
    title="ChronAI",
    description="AI-powered productivity companion",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for real-time chat with AI agents.

    Protocol:
        Receive: {"type": "chat"|"voice", "content": "message", "auth_token": "token"}
        Send: {"type": "text"|"audio"|"task_update"|"notification", "content": "response", "agent": "name"}
    """
    await websocket.accept()

    # Per-connection conversation history to prevent cross-user leakage
    conversation_history: list[dict] = []
    connected_user_id: str | None = None

    try:
        while True:
            # Receive message from client
            raw_data = await websocket.receive_text()

            # Validate incoming message using shared schema
            try:
                ws_message = WebSocketMessage.model_validate_json(raw_data)
            except Exception:
                await websocket.send_json(
                    AgentResponse(
                        type=ResponseType.TEXT,
                        content="Invalid message format. Please send valid JSON.",
                        agent="system",
                    ).model_dump(mode="json")
                )
                continue

            msg_type = ws_message.type.value
            content = ws_message.content
            auth_token = ws_message.auth_token

            # Validate auth token if provided
            user = None
            if auth_token:
                try:
                    user = await verify_google_token(auth_token)
                except HTTPException:
                    await websocket.send_json(
                        {
                            "type": "text",
                            "content": "Authentication failed. Please sign in again.",
                            "agent": "system",
                        }
                    )
                    continue

            # Register connection with ConnectionManager on first auth
            if user and not connected_user_id:
                user_id = user.get("sub", user.get("id", ""))
                if user_id:
                    connected_user_id = user_id
                    connection_manager.connect(user_id, websocket)

            # Route based on message type
            if msg_type == "voice":
                # Process voice input then synthesize response
                orchestrator = AgentRegistry.get("orchestrator")
                if orchestrator:
                    result = await orchestrator.execute(
                        {
                            "message": content,
                            "auth_token": auth_token,
                            "user": user,
                            "conversation_history": conversation_history,
                        }
                    )

                    # Send text response first
                    await websocket.send_json(
                        {
                            "type": "text",
                            "content": result["content"],
                            "agent": result.get("agent", "orchestrator"),
                        }
                    )

                    # Then send audio response
                    voice_agent = AgentRegistry.get("voice")
                    if voice_agent:
                        audio_result = await voice_agent.execute(
                            {"message": result["content"]}
                        )
                        if audio_result.get("content"):
                            await websocket.send_json(
                                {
                                    "type": "audio",
                                    "content": audio_result["content"],
                                    "agent": "voice",
                                }
                            )

            else:
                # Standard chat message
                orchestrator = AgentRegistry.get("orchestrator")
                if orchestrator:
                    result = await orchestrator.execute(
                        {
                            "message": content,
                            "auth_token": auth_token,
                            "user": user,
                            "conversation_history": conversation_history,
                        }
                    )

                    # Determine response type
                    response_type = "text"
                    metadata = result.get("metadata", {})
                    routed_to = metadata.get("routed_to", [])
                    if "planner" in routed_to:
                        response_type = "task_update"

                    await websocket.send_json(
                        {
                            "type": response_type,
                            "content": result["content"],
                            "agent": result.get("agent", "orchestrator"),
                        }
                    )
                else:
                    await websocket.send_json(
                        {
                            "type": "text",
                            "content": "System is starting up. Please try again in a moment.",
                            "agent": "system",
                        }
                    )

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.send_json(
                AgentResponse(
                    type=ResponseType.TEXT,
                    content="An unexpected error occurred. Please try again.",
                    agent="system",
                ).model_dump(mode="json")
            )
        except Exception:
            pass
    finally:
        # Unregister connection from ConnectionManager
        if connected_user_id:
            connection_manager.disconnect(connected_user_id, websocket)


@app.post("/api/nudge/trigger")
async def trigger_nudge(
    user_id: Optional[str] = Query(default=None, description="Specific user ID to nudge"),
    x_api_key: Optional[str] = Header(default=None),
):
    """Trigger a manual nudge check for all users or a specific user.

    This endpoint is intended to be called by Google Cloud Scheduler
    on a periodic basis. It checks all (or a specific) user's tasks for
    approaching deadlines and sends nudge notifications via WebSocket.

    Args:
        user_id: Optional query param to nudge a specific user.
        x_api_key: API key for authentication (X-API-Key header).

    Returns:
        Summary of nudges generated and delivered.
    """
    # Validate API key using timing-safe comparison
    if not settings.SCHEDULER_API_KEY or not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    if not secrets.compare_digest(x_api_key, settings.SCHEDULER_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    nudges = await run_nudge_check(connection_manager, user_id=user_id)

    return {
        "status": "completed",
        "nudges_generated": len(nudges),
        "nudges_delivered": sum(1 for n in nudges if n.get("delivered")),
        "details": nudges,
    }


@app.get("/api/tasks")
async def get_tasks(auth_token: str = ""):
    """Get user's tasks from Google Tasks.

    Args:
        auth_token: Google OAuth token for authentication.

    Returns:
        List of tasks or error message.
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await verify_google_token(auth_token)

    planner = AgentRegistry.get("planner")
    if planner and hasattr(planner, "list_tasks"):
        tasks = await planner.list_tasks(auth_token)
        return {"tasks": tasks}

    return {"tasks": []}


@app.get("/api/calendar/events")
async def get_calendar_events(auth_token: str = "", days_ahead: int = 7):
    """Get user's calendar events.

    Args:
        auth_token: Google OAuth token for authentication.
        days_ahead: Number of days ahead to fetch events.

    Returns:
        List of calendar events or error message.
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await verify_google_token(auth_token)

    if mcp_client:
        try:
            events = await mcp_client.call_tool(
                "google-calendar",
                "list_events",
                {"auth_token": auth_token, "days_ahead": days_ahead},
            )
            return {"events": events}
        except Exception:
            return {"events": []}

    return {"events": []}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "agents": AgentRegistry.list_agents(),
        "mcp_servers": mcp_client.list_servers() if mcp_client else [],
    }
