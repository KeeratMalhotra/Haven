"""Scheduler Agent - Calendar management and time optimization.

Finds optimal time slots for tasks and events using Vertex AI Gemini,
and manages the calendar through the Google Calendar MCP server.
Optionally persists scheduled events to Firestore.
"""

import json
import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings
from app.db.firestore import get_db


SCHEDULER_PROMPT = """You are a scheduling specialist. Your job is to:
1. Find optimal time slots for tasks and meetings
2. Consider existing calendar events to avoid conflicts
3. Respect user preferences (working hours, breaks, etc.)

ACTION SELECTION RULES:
- If the user asks what's on their calendar, what events they have, or wants to see their schedule -> action: "list_events"
- If the user wants to find free time, available slots, or asks "when can I..." -> action: "find_slots"  
- If the user wants to create, schedule, or book an event/meeting -> action: "create_event"

When given a scheduling request, respond with a JSON object:
{
  "action": "find_slots|create_event|list_events",
  "event_details": {
    "summary": "event title",
    "description": "event description",
    "duration_minutes": 60,
    "preferred_time": "morning|afternoon|evening|any",
    "date_range_days": 7
  },
  "response": "A natural language response explaining what you're doing"
}

EXAMPLES:
- "What's on my calendar this week?" -> action: "list_events", response: "Let me check your calendar for this week."
- "Find me a free slot tomorrow" -> action: "find_slots"
- "Schedule a meeting at 2pm" -> action: "create_event"

Default working hours: 9 AM - 6 PM. Default break: 30 min between meetings.
"""


class SchedulerAgent(AgentBase):
    """Scheduler agent that manages calendar and finds optimal time slots.

    Uses Vertex AI Gemini for intelligent scheduling decisions and the Google Calendar
    MCP server for calendar operations.
    """

    name = "scheduler"
    description = "Finds optimal time slots and manages calendar events"
    capabilities = ["find_free_slots", "create_event", "list_events", "scheduling"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the scheduler with Vertex AI GenerativeModel.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel(settings.GEMINI_MODEL)

    async def execute(self, task: dict) -> dict:
        """Handle a scheduling request.

        Args:
            task: Dict with 'message' (scheduling request),
                  'auth_token' for Google Calendar API access,
                  'user_id' for optional Firestore persistence.

        Returns:
            Dict with 'content' (scheduling result), 'agent' name.
        """
        message = task.get("message", "")
        auth_token = task.get("auth_token", "")
        user_id = task.get("user_id", "")

        logger.info(f"[scheduler] Executing action={task.get('message', '')[:50]}, has_mcp={bool(self.mcp_client)}, has_token={bool(auth_token)}")

        # Use Gemini to understand the scheduling request (single LLM call).
        schedule_plan = await self._analyze_scheduling_request(message)
        action = schedule_plan.get("action", "find_slots")

        # Execute the appropriate calendar operation, formatting results with
        # pure Python (no second Gemini call).
        if self.mcp_client and auth_token:
            if action == "list_events":
                result = await self._list_events(auth_token)
                schedule_plan["response"] = self._format_events(result)

            elif action == "find_slots":
                result = await self._find_free_slots(auth_token, schedule_plan.get("event_details", {}))
                schedule_plan["response"] = self._format_free_slots(
                    result, schedule_plan.get("response", "")
                )

            elif action == "create_event":
                event_details = schedule_plan.get("event_details", {})
                result = await self._create_event(auth_token, event_details)
                if result and not (isinstance(result, dict) and result.get("error")):
                    schedule_plan["response"] = (
                        schedule_plan.get("response", "")
                        + "\n\nEvent created successfully!"
                    ).strip()
                    # Optionally persist created event to Firestore
                    if user_id:
                        await self._persist_event_to_firestore(user_id, event_details, result)
                else:
                    schedule_plan["response"] = (
                        "I couldn't create that event. Please try again in a moment."
                    )

        return {
            "content": schedule_plan.get("response", "I can help you with scheduling."),
            "agent": self.name,
            "action": action,
        }

    @staticmethod
    def _format_events(events: list[dict]) -> str:
        """Format calendar events into a readable bulleted list.

        Args:
            events: List of event dicts with summary/start/end fields.

        Returns:
            A friendly summary string, handling the empty state.
        """
        real_events = [
            e for e in (events or []) if isinstance(e, dict) and not e.get("error")
        ]

        if not real_events:
            return "Your calendar is clear this week!"

        lines = [f"You have {len(real_events)} event(s) coming up:"]
        for e in real_events:
            summary = e.get("summary") or "Untitled event"
            when = SchedulerAgent._format_when(e.get("start", ""))
            lines.append(f"• {when}{summary}" if when else f"• {summary}")
        return "\n".join(lines)

    @staticmethod
    def _format_when(start: str) -> str:
        """Turn an ISO start string into a short prefix like 'Mon 2pm — '."""
        if not start:
            return ""
        try:
            dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return ""
        day = dt.strftime("%a")
        hour = dt.hour % 12 or 12
        ampm = "am" if dt.hour < 12 else "pm"
        if dt.minute:
            return f"{day} {hour}:{dt.minute:02d}{ampm} — "
        return f"{day} {hour}{ampm} — "

    @staticmethod
    def _format_free_slots(slots: list[dict], intro: str) -> str:
        """Format available time slots into a readable list."""
        real_slots = [
            s for s in (slots or []) if isinstance(s, dict) and not s.get("error")
        ]

        if not real_slots:
            return "I couldn't find any open slots in that window. Want me to widen the search?"

        lines = [intro.strip() or "Here are some open slots:"]
        for s in real_slots[:5]:
            when = SchedulerAgent._format_when(s.get("start", ""))
            mins = s.get("duration_minutes", "")
            label = f"• {when}".rstrip(" —") if when else "• slot"
            if mins:
                label += f" ({mins} min free)"
            lines.append(label)
        return "\n".join(lines)

    async def _analyze_scheduling_request(self, message: str) -> dict:
        """Use Gemini to analyze a scheduling request.

        Args:
            message: The user's scheduling-related message.

        Returns:
            Scheduling plan with action and event details.
        """
        prompt = f"""{SCHEDULER_PROMPT}

Scheduling request: {message}"""

        text = await self.generate(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            fallback="",
        )
        try:
            return json.loads(text)
        except Exception:
            return {
                "action": "find_slots",
                "event_details": {"summary": message, "duration_minutes": 60},
                "response": f"I'll help you find time for: {message}",
            }

    async def _list_events(self, auth_token: str) -> list[dict]:
        """List upcoming calendar events.

        Args:
            auth_token: Google OAuth token for API access.

        Returns:
            List of event dictionaries.
        """
        try:
            return await self.call_mcp_tool(
                "google-calendar",
                "list_events",
                {"auth_token": auth_token, "days_ahead": 7},
            )
        except Exception as e:
            logger.error(f"[scheduler] _list_events failed: {e}", exc_info=True)
            return []

    async def _find_free_slots(self, auth_token: str, details: dict) -> list[dict]:
        """Find free time slots in the calendar.

        Args:
            auth_token: Google OAuth token for API access.
            details: Event details with duration and preferences.

        Returns:
            List of available time slot dictionaries.
        """
        try:
            return await self.call_mcp_tool(
                "google-calendar",
                "find_free_slots",
                {
                    "auth_token": auth_token,
                    "duration_minutes": details.get("duration_minutes", 60),
                    "days_ahead": details.get("date_range_days", 7),
                },
            )
        except Exception as e:
            logger.error(f"[scheduler] _find_free_slots failed: {e}", exc_info=True)
            return []

    async def _create_event(self, auth_token: str, details: dict) -> dict:
        """Create a calendar event.

        Args:
            auth_token: Google OAuth token for API access.
            details: Event details including summary, start, end, etc.

        Returns:
            Created event data or empty dict on failure.
        """
        try:
            return await self.call_mcp_tool(
                "google-calendar",
                "create_event",
                {
                    "auth_token": auth_token,
                    "summary": details.get("summary", "New Event"),
                    "description": details.get("description", ""),
                    "duration_minutes": details.get("duration_minutes", 60),
                },
            )
        except Exception as e:
            logger.error(f"[scheduler] _create_event failed: {e}", exc_info=True)
            return {}

    async def _persist_event_to_firestore(
        self, user_id: str, event_details: dict, result: dict
    ) -> None:
        """Log a scheduled event to Firestore for history tracking.

        Args:
            user_id: The user ID who owns this event.
            event_details: The planned event details from Gemini.
            result: The result from the calendar API creation.
        """
        try:
            db = get_db()
            event_doc = {
                "user_id": user_id,
                "summary": event_details.get("summary", ""),
                "description": event_details.get("description", ""),
                "duration_minutes": event_details.get("duration_minutes", 60),
                "calendar_result": result if isinstance(result, dict) else {},
                "created_at": datetime.utcnow(),
            }
            await db.collection("scheduled_events").document().set(event_doc)
        except Exception:
            # Non-critical: don't fail the scheduling if persistence fails
            pass
