"""Habit Tracking Agent - Manages user habits, streaks, and check-ins.

Classifies user intent (create, list, check-in, delete) using Vertex AI
Gemini and persists habit data via HabitRepository.
"""

import json
import logging
from datetime import datetime
from typing import Any

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings
from app.db.models import Habit
from app.db.repositories import HabitRepository
from app.utils.timectx import now_ist, time_context_string

logger = logging.getLogger(__name__)


HABIT_PROMPT = """You are a habit tracking assistant. Classify the user's message into exactly one action.

ACTIONS:
- "create_habit": The user wants to create or start tracking a new habit.
- "list_habits": The user wants to see their current habits and streaks.
- "check_in": The user is reporting they completed a habit (e.g. "went to gym", "done with meditation", "did my workout").
- "delete_habit": The user wants to stop tracking or remove a habit.

Respond with JSON:
{
  "action": "create_habit" | "list_habits" | "check_in" | "delete_habit",
  "habit_name": "name of the habit if relevant, otherwise empty string",
  "frequency": "daily" | "weekly" | "weekdays" (only for create_habit, default "daily"),
  "target_days": number (only for create_habit, how many days per week the user aims for, default 7)
}

Examples:
- "I want to track my gym habit" -> {"action": "create_habit", "habit_name": "gym", "frequency": "daily", "target_days": 7}
- "Start tracking meditation 5 days a week" -> {"action": "create_habit", "habit_name": "meditation", "frequency": "weekdays", "target_days": 5}
- "How are my habits going?" -> {"action": "list_habits", "habit_name": "", "frequency": "daily", "target_days": 7}
- "I went to the gym today" -> {"action": "check_in", "habit_name": "gym", "frequency": "daily", "target_days": 7}
- "Done with reading" -> {"action": "check_in", "habit_name": "reading", "frequency": "daily", "target_days": 7}
- "Remove my running habit" -> {"action": "delete_habit", "habit_name": "running", "frequency": "daily", "target_days": 7}
"""


class HabitAgent(AgentBase):
    """Habit tracking agent that manages habits, streaks, and check-ins.

    Uses Vertex AI Gemini to classify user intent and HabitRepository
    for persistence.
    """

    name = "habits"
    description = "Tracks habits, streaks, and daily check-ins"
    capabilities = ["create_habit", "list_habits", "check_in", "delete_habit"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the habit agent with Vertex AI GenerativeModel.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel(settings.GEMINI_MODEL)

    async def execute(self, task: dict) -> dict:
        """Execute a habit-related action based on user intent.

        Args:
            task: Dict with 'message', 'auth_token', 'user_id'.

        Returns:
            Dict with 'content' (response text), 'agent' name, and 'action'.
        """
        message = task.get("message", "")
        user_id = task.get("user_id", "")

        # Classify intent using Gemini
        plan = await self._classify_intent(message)
        action = plan.get("action", "list_habits")
        habit_name = plan.get("habit_name", "")

        if action == "create_habit":
            return await self._create_habit(
                user_id,
                habit_name,
                plan.get("frequency", "daily"),
                plan.get("target_days", 7),
            )
        elif action == "check_in":
            return await self._check_in(user_id, habit_name)
        elif action == "delete_habit":
            return await self._delete_habit(user_id, habit_name)
        else:
            return await self._list_habits(user_id)

    async def _classify_intent(self, message: str) -> dict:
        """Use Gemini to classify the user's habit-related intent.

        Args:
            message: The user's message.

        Returns:
            Dict with 'action', 'habit_name', 'frequency', 'target_days'.
        """
        prompt = f"""{time_context_string()}

{HABIT_PROMPT}

User message: {message}"""

        text = await self.generate(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            fallback="",
        )
        try:
            return json.loads(text)
        except Exception:
            return {"action": "list_habits", "habit_name": "", "frequency": "daily", "target_days": 7}

    async def _create_habit(
        self, user_id: str, name: str, frequency: str, target_days: int
    ) -> dict:
        """Create a new habit for the user.

        Args:
            user_id: The user's ID.
            name: Name of the habit.
            frequency: Frequency string (daily, weekly, weekdays).
            target_days: Number of target days per week.

        Returns:
            Response dict.
        """
        if not name:
            return {
                "content": "What habit would you like to start tracking?",
                "agent": self.name,
                "action": "create_habit",
            }

        habit = Habit(
            user_id=user_id,
            name=name,
            frequency=frequency,
            target_days=target_days,
            streak=0,
        )
        created = await HabitRepository.create(habit)

        return {
            "content": f"Started tracking '{name}' ({frequency}, target: {target_days} days/week). Let's build that streak!",
            "agent": self.name,
            "action": "create_habit",
            "habit_id": created.id,
        }

    async def _list_habits(self, user_id: str) -> dict:
        """List all habits for the user with streak info.

        Args:
            user_id: The user's ID.

        Returns:
            Response dict with formatted habit list.
        """
        habits = await HabitRepository.list_by_user(user_id)

        if not habits:
            return {
                "content": "You're not tracking any habits yet. Want to start one? Try saying 'track my gym habit' or 'start tracking meditation'.",
                "agent": self.name,
                "action": "list_habits",
            }

        lines = [f"You're tracking {len(habits)} habit(s):"]
        for h in habits:
            streak_emoji = self._streak_emoji(h.streak)
            lines.append(f"  {streak_emoji} {h.name} - {h.streak} day streak ({h.frequency})")

        return {
            "content": "\n".join(lines),
            "agent": self.name,
            "action": "list_habits",
        }

    async def _check_in(self, user_id: str, habit_name: str) -> dict:
        """Record a check-in for a habit and update the streak.

        Args:
            user_id: The user's ID.
            habit_name: Name of the habit to check in.

        Returns:
            Response dict with updated streak.
        """
        if not habit_name:
            return {
                "content": "Which habit did you complete? Let me know the name.",
                "agent": self.name,
                "action": "check_in",
            }

        habit = await HabitRepository.get_by_name_and_user(habit_name, user_id)
        if not habit:
            return {
                "content": f"I couldn't find a habit called '{habit_name}'. Would you like to start tracking it?",
                "agent": self.name,
                "action": "check_in",
            }

        # Record the completion (increments streak + appends to history)
        # Returns False if already completed today (same-day deduplication).
        recorded = await HabitRepository.record_completion(habit.id)

        if not recorded:
            return {
                "content": f"You've already checked in '{habit.name}' today! Your streak is {habit.streak} days. Keep it up tomorrow!",
                "agent": self.name,
                "action": "check_in",
                "streak": habit.streak,
            }

        new_streak = habit.streak + 1
        celebration = self._celebration_message(new_streak)

        return {
            "content": f"Checked in for '{habit.name}'! {celebration} Streak: {new_streak} days.",
            "agent": self.name,
            "action": "check_in",
            "streak": new_streak,
        }

    async def _delete_habit(self, user_id: str, habit_name: str) -> dict:
        """Delete a habit for the user.

        Args:
            user_id: The user's ID.
            habit_name: Name of the habit to delete.

        Returns:
            Response dict confirming deletion.
        """
        if not habit_name:
            return {
                "content": "Which habit would you like to stop tracking?",
                "agent": self.name,
                "action": "delete_habit",
            }

        habit = await HabitRepository.get_by_name_and_user(habit_name, user_id)
        if not habit:
            return {
                "content": f"I couldn't find a habit called '{habit_name}'.",
                "agent": self.name,
                "action": "delete_habit",
            }

        await HabitRepository.delete(habit.id)

        return {
            "content": f"Stopped tracking '{habit.name}'. You had a {habit.streak} day streak.",
            "agent": self.name,
            "action": "delete_habit",
        }

    @staticmethod
    def _streak_emoji(streak: int) -> str:
        """Return an emoji indicator based on streak length."""
        if streak >= 30:
            return "🔥"
        elif streak >= 7:
            return "⭐"
        elif streak >= 1:
            return "✅"
        return "○"

    @staticmethod
    def _celebration_message(streak: int) -> str:
        """Return a short celebration message based on milestone streaks."""
        if streak == 7:
            return "One week strong!"
        elif streak == 14:
            return "Two weeks - amazing!"
        elif streak == 30:
            return "30 days! You're building a real habit!"
        elif streak == 100:
            return "100 days! Legendary!"
        elif streak % 10 == 0 and streak > 0:
            return f"{streak} days - keep it up!"
        return "Nice work!"
