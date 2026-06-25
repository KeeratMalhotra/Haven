"""Scheduler Agent - Calendar management and time optimization.

Finds optimal time slots for tasks and events using Vertex AI Gemini,
and manages the calendar through the Google Calendar MCP server.
Optionally persists scheduled events to Firestore.
"""

import asyncio
import json
from datetime import datetime
from typing import Any

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings
from app.db.firestore import get_db


SCHEDULER_PROMPT = """You are a scheduling specialist. Your job is to:
1. Find optimal time slots for tasks and meetings
2. Consider existing calendar events to avoid conflicts
3. Respect user preferences (working hours, breaks, etc.)

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
  "response": "A natural language response explaining the scheduling suggestion"
}

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
        self.model = GenerativeModel("gemini-2.5-flash")

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

        # Use Gemini to understand the scheduling request
        schedule_plan = await self._analyze_scheduling_request(message)
        action = schedule_plan.get("action", "find_slots")

        # Execute the appropriate calendar operation
        if self.mcp_client and auth_token:
            if action == "list_events":
                result = await self._list_events(auth_token)
                if result:
                    schedule_plan["response"] += f"\n\nYour upcoming events: {json.dumps(result, default=str)}"

            elif action == "find_slots":
                result = await self._find_free_slots(auth_token, schedule_plan.get("event_details", {}))
                if result:
                    schedule_plan["response"] += f"\n\nAvailable slots: {json.dumps(result, default=str)}"

            elif action == "create_event":
                event_details = schedule_plan.get("event_details", {})
                result = await self._create_event(auth_token, event_details)
                if result:
                    schedule_plan["response"] += "\n\nEvent created successfully!"
                    # Optionally persist created event to Firestore
                    if user_id:
                        await self._persist_event_to_firestore(user_id, event_details, result)

        return {
            "content": schedule_plan.get("response", "I can help you with scheduling."),
            "agent": self.name,
            "action": action,
        }

    async def _analyze_scheduling_request(self, message: str) -> dict:
        """Use Gemini to analyze a scheduling request.

        Args:
            message: The user's scheduling-related message.

        Returns:
            Scheduling plan with action and event details.
        """
        try:
            prompt = f"""{SCHEDULER_PROMPT}

Scheduling request: {message}"""

            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            return json.loads(response.text)
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
        except Exception:
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
        except Exception:
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
        except Exception:
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
