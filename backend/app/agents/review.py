"""Review Agent - Generates weekly productivity reviews.

Fetches calendar events, completed tasks, and habit data for the past week,
then uses Gemini to generate a personalized markdown review with insights
and suggestions.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings
from app.db.repositories import HabitRepository

logger = logging.getLogger(__name__)


REVIEW_PROMPT = """You are a productivity coach generating a weekly review for the user.
Based on the data provided, write a personalized, encouraging weekly review in markdown format.

Include these sections:
1. **Weekly Summary** - Brief overview of the week
2. **Tasks** - Tasks completed vs total, highlight achievements
3. **Calendar** - Number of meetings/events, busiest day
4. **Habits** - Streaks maintained, habits missed, consistency score
5. **Productivity Score** - A score out of 10 based on task completion, habit consistency, and calendar management
6. **Suggestion for Next Week** - One actionable tip based on patterns you see

Keep the tone positive and motivating. Use bullet points and short paragraphs.
If data is limited, acknowledge it and encourage the user to keep using Haven."""


async def generate_weekly_review(
    user_id: str, auth_token: str, mcp_client: Any = None, memory_context: str = ""
) -> str:
    """Generate a weekly productivity review for the user.

    Fetches the last 7 days of calendar events (via MCP), completed tasks
    (via MCP), and habit check-ins (via HabitRepository). Uses Gemini to
    produce a personalized markdown review.

    Args:
        user_id: The user's ID.
        auth_token: Google OAuth access token for MCP calls.
        mcp_client: Optional MCP client instance for calendar/tasks queries.
        memory_context: Optional relevant memories context for personalization.

    Returns:
        Markdown-formatted weekly review text.
    """
    # Gather data from the past 7 days
    events = []
    tasks = []
    habits = []

    # Fetch calendar events via MCP
    if mcp_client and auth_token:
        try:
            events = await mcp_client.call_tool(
                "google-calendar",
                "list_events",
                {"auth_token": auth_token, "days_ahead": 0, "days_back": 7},
            )
            if not isinstance(events, list):
                events = []
        except Exception as e:
            logger.warning(f"Failed to fetch calendar events for review: {e}")
            events = []

    # Fetch completed tasks via MCP
    if mcp_client and auth_token:
        try:
            tasks = await mcp_client.call_tool(
                "google-tasks",
                "list_tasks",
                {"auth_token": auth_token, "show_completed": True},
            )
            if not isinstance(tasks, list):
                tasks = []
        except Exception as e:
            logger.warning(f"Failed to fetch tasks for review: {e}")
            tasks = []

    # Fetch habits from repository
    try:
        habit_list = await HabitRepository.list_by_user(user_id)
        habits = [h.model_dump() for h in habit_list]
    except Exception as e:
        logger.warning(f"Failed to fetch habits for review: {e}")
        habits = []

    # Build context for Gemini
    data_context = {
        "events_count": len(events),
        "events": events[:20] if events else [],
        "tasks_total": len(tasks),
        "tasks_completed": len([t for t in tasks if isinstance(t, dict) and t.get("status") in ("completed", "done")]),
        "tasks": tasks[:20] if tasks else [],
        "habits": habits,
    }

    # Generate review using Gemini
    vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
    model = GenerativeModel(settings.GEMINI_MODEL)

    prompt = f"""{REVIEW_PROMPT}
{memory_context}
Here is the user's data from the past week:
{json.dumps(data_context, indent=2, default=str)}

Generate the weekly review in markdown:"""

    try:
        response = await _generate_with_model(model, prompt)
        if response:
            return response
    except Exception as e:
        logger.error(f"Failed to generate weekly review: {e}")

    # Fallback response if Gemini fails
    return _fallback_review(data_context)


async def _generate_with_model(model: Any, prompt: str) -> str:
    """Run Gemini generation in a thread with timeout.

    Args:
        model: The GenerativeModel instance.
        prompt: The prompt to send.

    Returns:
        The generated text, or empty string on failure.
    """
    import asyncio

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, prompt),
            timeout=60.0,
        )
        return response.text
    except Exception as e:
        logger.error(f"Gemini review generation failed: {e}")
        return ""


def _fallback_review(data: dict) -> str:
    """Generate a simple fallback review when Gemini is unavailable.

    Args:
        data: The collected data context dict.

    Returns:
        Basic markdown review.
    """
    tasks_completed = data.get("tasks_completed", 0)
    tasks_total = data.get("tasks_total", 0)
    events_count = data.get("events_count", 0)
    habits = data.get("habits", [])

    active_streaks = sum(1 for h in habits if isinstance(h, dict) and h.get("streak", 0) > 0)

    return f"""# Weekly Review

## Summary
Here's your week at a glance.

## Tasks
- **Completed:** {tasks_completed} / {tasks_total} tasks

## Calendar
- **Events this week:** {events_count}

## Habits
- **Active streaks:** {active_streaks} / {len(habits)} habits
{chr(10).join(f"- {h.get('name', 'Unknown')}: {h.get('streak', 0)} day streak" for h in habits if isinstance(h, dict))}

## Productivity Score
**{min(10, max(1, tasks_completed + active_streaks))} / 10**

## Suggestion for Next Week
Keep up the momentum! Focus on maintaining your habit streaks and tackling your highest-priority tasks first.
"""


class ReviewAgent(AgentBase):
    """Weekly review agent that generates personalized productivity summaries.

    Uses Vertex AI Gemini to analyze the user's calendar, tasks, and habits
    from the past week and produces an insightful markdown review.
    """

    name = "review"
    description = "Generates weekly productivity reviews and summaries"
    capabilities = ["weekly_review", "productivity_report"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the review agent with Vertex AI GenerativeModel.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel(settings.GEMINI_MODEL)

    async def execute(self, task: dict) -> dict:
        """Generate a weekly review for the user.

        Args:
            task: Dict with 'message', 'auth_token', 'user_id'.

        Returns:
            Dict with 'content' (markdown review), 'agent' name.
        """
        auth_token = task.get("auth_token", "")
        user_id = task.get("user_id", "")

        memory_context = self._format_relevant_memories(task)
        review = await generate_weekly_review(
            user_id, auth_token, self.mcp_client, memory_context=memory_context
        )

        return {
            "content": review,
            "agent": self.name,
            "action": "weekly_review",
        }
