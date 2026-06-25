"""ChronAI Backend - FastAPI server with WebSocket chat and AI agents."""

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.agents.base import AgentRegistry
from app.agents.orchestrator import OrchestratorAgent
from app.agents.planner import PlannerAgent
from app.agents.scheduler import SchedulerAgent
from app.agents.notification import NotificationAgent
from app.agents.voice import VoiceAgent
from app.auth import verify_google_token
from app.config import settings
from app.db.firestore import init_firestore
from app.mcp.client import MCPClient

# Add shared package to path so we can import shared schemas
_shared_path = str(Path(__file__).resolve().parent.parent.parent / "shared")
if _shared_path not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from shared.schemas import WebSocketMessage, AgentResponse, MessageType, ResponseType


# Global MCP client instance
mcp_client: MCPClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle.

    Initializes MCP client, connects to MCP servers,
    and registers all agents on startup. Cleans up on shutdown.
    """
    global mcp_client

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

    # Register agents
    OrchestratorAgent(mcp_client=mcp_client)
    PlannerAgent(mcp_client=mcp_client)
    SchedulerAgent(mcp_client=mcp_client)
    NotificationAgent(mcp_client=mcp_client)
    VoiceAgent(mcp_client=mcp_client)

    yield

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
        Send: {"type": "text"|"audio"|"task_update", "content": "response", "agent": "name"}
    """
    await websocket.accept()

    # Per-connection conversation history to prevent cross-user leakage
    conversation_history: list[dict] = []

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
