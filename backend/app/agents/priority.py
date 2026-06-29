"""Priority Agent - Intelligent task prioritization engine.

Fetches the user's tasks and calendar events, then uses Gemini to rank them
by urgency x importance. Returns a prioritized list with color-coded indicators.
"""

import json
import logging
from typing import Any

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings
from app.utils.timectx import time_context_string
from app.utils.user_context import get_user_context


logger = logging.getLogger(__name__)


PRIORITY_PROMPT = """You are a priority ranking specialist. Given a user's tasks and calendar events for today, rank them by urgency x importance.

URGENCY FACTORS:
- Deadline proximity (hours/days until due)
- Meeting preparation needed (events requiring prep get boosted)
- Dependencies (tasks blocking other work are more urgent)
- Time of day sensitivity (morning tasks that are overdue)

IMPORTANCE FACTORS:
- User's stated priorities from their profile
- Task context and impact (work deliverables > errands)
- Recurring vs one-time (deadlines > routine)

OUTPUT FORMAT:
Return a JSON object with:
{
  "priorities": [
    {
      "title": "task or event title",
      "urgency": "high" | "medium" | "low",
      "reason": "brief explanation of why this ranks here",
      "time_estimate": "optional time estimate if known"
    }
  ],
  "summary": "A natural language summary like: Here's what matters most right now:"
}

Rules:
- Rank by urgency x importance (highest first)
- Maximum 10 items in the list
- Use "high" for items due within hours or critical deadlines
- Use "medium" for items due within 1-2 days or moderately important
- Use "low" for items with no pressing deadline or low impact
- If no tasks/events exist, return an encouraging empty-state message
"""


class PriorityAgent(AgentBase):
    """Priority agent that ranks tasks by urgency x importance."""

    name = "priority"
    description = "Ranks tasks and events by urgency and importance"
    capabilities = ["task_prioritization", "focus_recommendation"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the priority agent with Vertex AI GenerativeModel.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel(settings.GEMINI_MODEL)

    async def execute(self, task: dict) -> dict:
        """Fetch tasks and events, then rank by priority.

        Args:
            task: Dict with 'message', 'auth_token', 'user_id'.

        Returns:
            Dict with 'content' (prioritized list), 'agent' name,
            and 'priorities' (structured list).
        """
        auth_token = task.get("auth_token", "")
        user_id = task.get("user_id", "")

        # Fetch tasks and events in parallel
        tasks_list = await self._fetch_tasks(auth_token)
        events_list = await self._fetch_events(auth_token)

        # Get user context for importance weighting
        user_context = await get_user_context(user_id)

        # Include relevant memories for personalization
        memory_context = self._format_relevant_memories(task)

        # Use Gemini to rank
        priorities = await self._rank_priorities(tasks_list, events_list, user_context, memory_context)

        # Format the response
        content = self._format_priorities(priorities)

        return {
            "content": content,
            "agent": self.name,
            "action": "prioritize",
            "priorities": priorities.get("priorities", []),
        }

    async def _fetch_tasks(self, auth_token: str) -> list:
        """Fetch tasks from Google Tasks via MCP."""
        if not self.mcp_client or not auth_token:
            return []
        try:
            result = await self.call_mcp_tool(
                "google-tasks",
                "list_tasks",
                {"auth_token": auth_token},
            )
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.warning(f"[priority] Failed to fetch tasks: {e}")
            return []

    async def _fetch_events(self, auth_token: str) -> list:
        """Fetch today's calendar events via MCP."""
        if not self.mcp_client or not auth_token:
            return []
        try:
            result = await self.call_mcp_tool(
                "google-calendar",
                "list_events",
                {"auth_token": auth_token, "days_ahead": 1},
            )
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.warning(f"[priority] Failed to fetch events: {e}")
            return []

    async def _rank_priorities(
        self, tasks: list, events: list, user_context: str, memory_context: str = ""
    ) -> dict:
        """Use Gemini to rank tasks and events by priority."""
        prompt = f"""{time_context_string()}

{PRIORITY_PROMPT}

{user_context}
{memory_context}
User's current tasks:
{json.dumps(tasks, default=str)}

User's calendar events for today:
{json.dumps(events, default=str)}

Rank these items by urgency x importance."""

        text = await self.generate(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            fallback="",
        )
        try:
            result = json.loads(text)
            if isinstance(result, dict) and "priorities" in result:
                return result
        except Exception:
            pass

        # Fallback: return tasks in order with default urgency
        fallback_priorities = []
        for t in tasks[:10]:
            if isinstance(t, dict) and not t.get("error"):
                fallback_priorities.append({
                    "title": t.get("title", "Untitled task"),
                    "urgency": "medium",
                    "reason": "No ranking available",
                })
        return {
            "priorities": fallback_priorities,
            "summary": "Here's what matters most right now:",
        }

    @staticmethod
    def _format_priorities(priorities: dict) -> str:
        """Format priorities into a readable string with emoji indicators."""
        items = priorities.get("priorities", [])
        summary = priorities.get(
            "summary", "Here's what matters most right now:"
        )

        if not items:
            return "You're all clear! No pressing tasks or events right now. Enjoy the focus time."

        urgency_emoji = {
            "high": "\U0001f534",    # red circle
            "medium": "\U0001f7e1",  # yellow circle
            "low": "\U0001f7e2",     # green circle
        }

        lines = [summary]
        for i, item in enumerate(items, 1):
            emoji = urgency_emoji.get(item.get("urgency", "medium"), "\U0001f7e1")
            title = item.get("title", "Untitled")
            reason = item.get("reason", "")
            line = f"{i}. {emoji} {title}"
            if reason:
                line += f" ({reason})"
            lines.append(line)

        return "\n".join(lines)
