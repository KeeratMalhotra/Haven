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
from pydantic import BaseModel

from app.agents.base import AgentRegistry
from app.agents.orchestrator import OrchestratorAgent
from app.agents.planner import PlannerAgent
from app.agents.scheduler import SchedulerAgent
from app.agents.priority import PriorityAgent
from app.agents.notification import NotificationAgent
from app.agents.voice import VoiceAgent
from app.agents.email import EmailAgent
from app.agents.habits import HabitAgent
from app.agents.review import ReviewAgent, generate_weekly_review
from app.api.onboarding import router as onboarding_router
from app.api.briefing import router as briefing_router
from app.auth import verify_google_token
from app.config import settings
from app.db.firestore import init_firestore
from app.db.repositories import HabitRepository
from app.db.models import Habit
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


def _make_status_callback(websocket: WebSocket):
    """Build an async status callback bound to a WebSocket connection.

    The orchestrator calls this before each slow agent dispatch so the user
    sees real-time progress (e.g. "Checking your calendar...").
    """

    async def _status_callback(payload: dict) -> None:
        try:
            await websocket.send_json(payload)
        except Exception:
            # Never let a status update break the main response flow.
            pass

    return _status_callback


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

    # Store mcp_client on app state for dependency injection
    app.state.mcp_client = mcp_client

    # Resolve MCP server paths relative to the backend directory so that
    # relative paths (e.g. "../mcp-servers/...") work correctly on Windows.
    base_dir = Path(__file__).resolve().parent.parent  # points to backend/
    calendar_path = str((base_dir / settings.MCP_CALENDAR_PATH).resolve())
    tasks_path = str((base_dir / settings.MCP_TASKS_PATH).resolve())
    gmail_path = str((base_dir / settings.MCP_GMAIL_PATH).resolve())

    logger = logging.getLogger(__name__)

    # Connect to MCP servers (they run as subprocesses)
    # Use sys.executable to ensure the same Python interpreter (and venv) is used.
    import sys as _sys
    python_cmd = _sys.executable

    try:
        await mcp_client.connect_server(
            name="google-calendar",
            command=python_cmd,
            args=[calendar_path],
        )
    except Exception as e:
        logger.warning(f"Failed to connect MCP server 'google-calendar': {e}")

    try:
        await mcp_client.connect_server(
            name="google-tasks",
            command=python_cmd,
            args=[tasks_path],
        )
    except Exception as e:
        logger.warning(f"Failed to connect MCP server 'google-tasks': {e}")

    # Small delay before third server — works around a Windows asyncio race
    # condition where rapid subprocess spawning causes "Connection closed".
    import asyncio as _asyncio
    await _asyncio.sleep(1.0)

    # Gmail MCP has persistent connection issues on Windows during lifespan
    # startup (subprocess stdio handshake race). Connect it lazily on first
    # use instead. Store the path for deferred connection.
    app.state.gmail_mcp_path = gmail_path
    app.state.gmail_mcp_connected = False

    try:
        await mcp_client.connect_server(
            name="google-gmail",
            command=python_cmd,
            args=[gmail_path],
        )
        app.state.gmail_mcp_connected = True
    except Exception as e:
        logger.warning(f"Gmail MCP deferred — will retry on first use: {e}")

    # Register agents
    OrchestratorAgent(mcp_client=mcp_client)
    PlannerAgent(mcp_client=mcp_client)
    SchedulerAgent(mcp_client=mcp_client)
    PriorityAgent(mcp_client=mcp_client)
    NotificationAgent(mcp_client=mcp_client)
    VoiceAgent(mcp_client=mcp_client)
    EmailAgent(mcp_client=mcp_client)
    HabitAgent(mcp_client=mcp_client)
    ReviewAgent(mcp_client=mcp_client)

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

# Register API routers
app.include_router(onboarding_router)
app.include_router(briefing_router)


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
    # Per-connection pending clarification/confirmation the orchestrator is
    # waiting on (e.g. "what time is your meeting?"). JSON-serializable dict.
    pending_action: dict | None = None

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
                            "type": "error",
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
                            "pending_action": pending_action,
                        },
                        status_callback=_make_status_callback(websocket),
                    )

                    # Persist any pending clarification for the next turn.
                    pending_action = result.get("pending_action")

                    # Send text response first
                    await websocket.send_json(
                        {
                            "type": "text",
                            "content": result["content"],
                            "agent": result.get("agent", "orchestrator"),
                        }
                    )

                    # Then send audio response (optional, fail silently)
                    try:
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
                    except Exception:
                        pass  # Voice TTS is optional; don't break chat flow

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
                            "pending_action": pending_action,
                        },
                        status_callback=_make_status_callback(websocket),
                    )

                    # Persist any pending clarification for the next turn.
                    pending_action = result.get("pending_action")

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


class CreateEventRequest(BaseModel):
    """Request body for creating a calendar event."""
    summary: str
    start_time: str
    duration_minutes: int = 60
    auth_token: str


@app.post("/api/calendar/events")
async def create_calendar_event(body: CreateEventRequest):
    """Create a new calendar event.

    Args:
        body: Validated JSON body with summary, start_time, duration_minutes, and auth_token.

    Returns:
        The created event or error message.
    """
    auth_token = body.auth_token
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await verify_google_token(auth_token)

    if mcp_client:
        try:
            result = await mcp_client.call_tool(
                "google-calendar",
                "create_event",
                {
                    "auth_token": auth_token,
                    "summary": body.summary,
                    "start_time": body.start_time,
                    "duration_minutes": body.duration_minutes,
                },
            )
            return result
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create event: {e}",
            )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="MCP client not available",
    )


@app.delete("/api/calendar/events/{event_id}")
async def delete_calendar_event(event_id: str, auth_token: str = ""):
    """Delete a calendar event.

    Args:
        event_id: The ID of the event to delete.
        auth_token: Google OAuth token for authentication.

    Returns:
        Status indicating deletion success.
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await verify_google_token(auth_token)

    if mcp_client:
        try:
            await mcp_client.call_tool(
                "google-calendar",
                "delete_event",
                {"auth_token": auth_token, "event_id": event_id},
            )
            return {"status": "deleted"}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete event: {e}",
            )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="MCP client not available",
    )


class CreateHabitRequest(BaseModel):
    """Request body for creating a habit."""
    auth_token: str
    name: str
    frequency: str = "daily"
    target_days: int = 7


class HabitCheckinRequest(BaseModel):
    """Request body for checking in to a habit."""
    auth_token: str
    habit_id: str


@app.get("/api/habits")
async def get_habits(auth_token: str = ""):
    """Get user's habits.

    Args:
        auth_token: Google OAuth token for authentication.

    Returns:
        List of habits for the user.
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    habits = await HabitRepository.list_by_user(user_id)
    return {"habits": [h.model_dump() for h in habits]}


@app.post("/api/habits")
async def create_habit(body: CreateHabitRequest):
    """Create a new habit.

    Args:
        body: Validated JSON body with auth_token, name, frequency, target_days.

    Returns:
        The created habit.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user = await verify_google_token(body.auth_token)
    user_id = user.get("sub", "")

    habit = Habit(
        user_id=user_id,
        name=body.name,
        frequency=body.frequency,
        target_days=body.target_days,
    )
    created = await HabitRepository.create(habit)
    return {"habit": created.model_dump()}


@app.post("/api/habits/checkin")
async def checkin_habit(body: HabitCheckinRequest):
    """Record a habit check-in.

    Args:
        body: Validated JSON body with auth_token and habit_id.

    Returns:
        Updated habit with new streak count.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user = await verify_google_token(body.auth_token)
    user_id = user.get("sub", "")

    habit = await HabitRepository.get_by_id(body.habit_id)
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found",
        )

    if habit.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this habit",
        )

    await HabitRepository.record_completion(body.habit_id)

    # Fetch the updated habit
    updated = await HabitRepository.get_by_id(body.habit_id)
    return {"habit": updated.model_dump() if updated else habit.model_dump()}


@app.delete("/api/habits/{habit_id}")
async def delete_habit(habit_id: str, auth_token: str = ""):
    """Delete a habit.

    Args:
        habit_id: The ID of the habit to delete.
        auth_token: Google OAuth token for authentication.

    Returns:
        Status indicating deletion success.
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    habit = await HabitRepository.get_by_id(habit_id)
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found",
        )

    if habit.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this habit",
        )

    await HabitRepository.delete(habit_id)
    return {"status": "deleted"}


@app.get("/api/review/weekly")
async def get_weekly_review(auth_token: str = ""):
    """Get a personalized weekly productivity review.

    Fetches calendar events, completed tasks, and habit data from the past
    week and generates a markdown-formatted review with insights.

    Args:
        auth_token: Google OAuth token for authentication.

    Returns:
        Dict with 'review' key containing the markdown review text.
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    review = await generate_weekly_review(user_id, auth_token, mcp_client)
    return {"review": review}


@app.get("/api/priorities")
async def get_priorities(auth_token: str = ""):
    """Get prioritized task list ranked by urgency x importance.

    Fetches the user's tasks and calendar events, then uses AI to rank
    them by urgency and importance factors.

    Args:
        auth_token: Google OAuth token for authentication.

    Returns:
        Dict with 'priorities' (ranked list) and 'content' (formatted text).
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    priority_agent = AgentRegistry.get("priority")
    if not priority_agent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Priority agent not available",
        )

    result = await priority_agent.execute({
        "message": "prioritize my tasks",
        "auth_token": auth_token,
        "user_id": user_id,
    })

    return {
        "priorities": result.get("priorities", []),
        "content": result.get("content", ""),
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "agents": AgentRegistry.list_agents(),
        "mcp_servers": mcp_client.list_servers() if mcp_client else [],
    }
