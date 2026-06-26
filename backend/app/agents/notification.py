"""Notification Agent - Context-aware reminders and proactive suggestions.

Generates intelligent reminders with escalating urgency based on deadline
proximity. Provides proactive suggestions using Vertex AI Gemini.
Uses Firestore as a fallback source for task data when MCP is unavailable.
"""

import json
from datetime import datetime, timedelta
from typing import Any

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings
from app.db.repositories import TaskRepository


NOTIFICATION_PROMPT = """You are a notification specialist. Your job is to:
1. Generate context-aware reminders based on tasks and deadlines
2. Escalate urgency based on how close a deadline is
3. Provide proactive suggestions to help the user stay on track

Given the user's tasks and current context, respond with JSON:
{
  "notifications": [
    {
      "message": "the notification text",
      "urgency": "low|medium|high|critical",
      "task_title": "related task title or null",
      "suggestion": "proactive suggestion if applicable"
    }
  ],
  "response": "A natural language summary of notifications/suggestions"
}

Urgency levels:
- critical: Due within 2 hours or overdue
- high: Due today
- medium: Due within 3 days
- low: Due within a week
"""


class NotificationAgent(AgentBase):
    """Notification agent for context-aware reminders.

    Generates reminders with escalating urgency and proactive suggestions
    using Vertex AI Gemini for contextual awareness.
    """

    name = "notification"
    description = "Generates context-aware reminders and proactive suggestions"
    capabilities = ["reminders", "urgency_escalation", "proactive_suggestions"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the notification agent with Vertex AI GenerativeModel.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel(settings.GEMINI_MODEL)

    async def execute(self, task: dict) -> dict:
        """Generate notifications and suggestions.

        Args:
            task: Dict with 'message' (context/request),
                  'auth_token' for task data access,
                  'user_id' for Firestore fallback.

        Returns:
            Dict with 'content' (notification summary), 'agent' name,
            and 'notifications' list.
        """
        message = task.get("message", "")
        auth_token = task.get("auth_token", "")
        user_id = task.get("user_id", "")

        # Get current tasks for context if available
        tasks_context = []
        if self.mcp_client and auth_token:
            tasks_context = await self._get_tasks_context(auth_token)

        # Fallback to Firestore if MCP returned no tasks
        if not tasks_context and user_id:
            tasks_context = await self._get_tasks_from_firestore(user_id)

        # Generate notifications using Gemini
        notifications = await self._generate_notifications(message, tasks_context)

        return {
            "content": notifications.get("response", "No pending notifications."),
            "agent": self.name,
            "notifications": notifications.get("notifications", []),
        }

    async def _get_tasks_context(self, auth_token: str) -> list[dict]:
        """Fetch current tasks for notification context.

        Args:
            auth_token: Google OAuth token for API access.

        Returns:
            List of task dictionaries.
        """
        try:
            result = await self.call_mcp_tool(
                "google-tasks", "list_tasks", {"auth_token": auth_token}
            )
            return result if isinstance(result, list) else []
        except Exception:
            return []

    async def _get_tasks_from_firestore(self, user_id: str) -> list[dict]:
        """Fetch tasks from Firestore as a fallback data source.

        Args:
            user_id: The user's ID for querying tasks.

        Returns:
            List of task dictionaries from Firestore.
        """
        try:
            tasks = await TaskRepository.list_by_user(user_id)
            return [t.model_dump(mode="json") for t in tasks]
        except Exception:
            return []

    async def _generate_notifications(
        self, message: str, tasks: list[dict]
    ) -> dict:
        """Use Gemini to generate contextual notifications.

        Args:
            message: User's message or context for notification generation.
            tasks: Current tasks to analyze for deadline proximity.

        Returns:
            Notification plan with messages and urgency levels.
        """
        try:
            now = datetime.now().isoformat()
            tasks_text = json.dumps(tasks, default=str) if tasks else "No tasks found"

            prompt = f"""{NOTIFICATION_PROMPT}

Current time: {now}
User context: {message}
Current tasks: {tasks_text}

Generate appropriate notifications and proactive suggestions."""

            text = await self.generate(
                prompt,
                generation_config={"response_mime_type": "application/json"},
                fallback="",
            )
            return json.loads(text)
        except Exception:
            return {
                "notifications": [],
                "response": "I'll keep an eye on your tasks and let you know about upcoming deadlines.",
            }

    def calculate_urgency(self, due_date: datetime) -> str:
        """Calculate urgency level based on deadline proximity.

        Args:
            due_date: The task's due date.

        Returns:
            Urgency string: 'critical', 'high', 'medium', or 'low'.
        """
        now = datetime.now()
        delta = due_date - now

        if delta < timedelta(hours=0):
            return "critical"  # Overdue
        elif delta < timedelta(hours=2):
            return "critical"
        elif delta < timedelta(days=1):
            return "high"
        elif delta < timedelta(days=3):
            return "medium"
        else:
            return "low"
