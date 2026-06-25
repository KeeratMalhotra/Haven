"""Planner Agent - Task decomposition and management.

Breaks user goals into subtasks with deadlines using Gemini,
and manages tasks through the Google Tasks MCP server.
Persists created tasks to Firestore via TaskRepository.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any

from google import genai

from app.agents.base import AgentBase
from app.config import settings
from app.db.models import Task as TaskModel
from app.db.repositories import TaskRepository


logger = logging.getLogger(__name__)


PLANNER_PROMPT = """You are a task planning specialist. Your job is to:
1. Break down user goals into actionable subtasks
2. Assign reasonable deadlines based on complexity
3. Prioritize tasks logically

When given a goal, respond with a JSON object:
{
  "plan_summary": "brief description of the plan",
  "tasks": [
    {
      "title": "task title",
      "notes": "additional details or instructions",
      "due_days_from_now": number_of_days,
      "priority": "high|medium|low"
    }
  ],
  "response": "A natural language summary to share with the user"
}

Be specific and actionable. Each task should be completable in one sitting.
"""


class PlannerAgent(AgentBase):
    """Planner agent that decomposes goals into tasks.

    Uses Gemini for intelligent task decomposition and the Google Tasks
    MCP server for task CRUD operations.
    """

    name = "planner"
    description = "Breaks goals into subtasks with deadlines"
    capabilities = ["task_decomposition", "task_creation", "task_listing"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the planner with Gemini client.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = "gemini-2.5-flash"

    async def execute(self, task: dict) -> dict:
        """Break down a goal into subtasks and optionally create them.

        Args:
            task: Dict with 'message' (the goal or instruction),
                  'auth_token' for Google API access,
                  'user_id' for Firestore persistence.

        Returns:
            Dict with 'content' (plan description), 'agent' name,
            and 'tasks' (list of created/planned tasks).
        """
        message = task.get("message", "")
        auth_token = task.get("auth_token", "")
        user_id = task.get("user_id", "")

        # Use Gemini to decompose the goal
        plan = await self._decompose_goal(message)

        # If MCP client is available, create tasks
        created_tasks = []
        if self.mcp_client and auth_token and plan.get("tasks"):
            for task_item in plan["tasks"]:
                try:
                    result = await self.call_mcp_tool(
                        "google-tasks",
                        "create_task",
                        {
                            "title": task_item["title"],
                            "notes": task_item.get("notes", ""),
                            "due_days_from_now": task_item.get("due_days_from_now", 7),
                            "auth_token": auth_token,
                        },
                    )
                    created_tasks.append(result)
                except Exception:
                    # Continue with other tasks even if one fails
                    pass

        # Persist tasks to Firestore
        persist_failures = 0
        if user_id and plan.get("tasks"):
            persist_failures = await self._persist_tasks_to_firestore(user_id, plan["tasks"])

        response_content = plan.get(
            "response", plan.get("plan_summary", "Plan created.")
        )

        if created_tasks:
            response_content += f"\n\nI've created {len(created_tasks)} task(s) in your Google Tasks."

        if persist_failures > 0:
            response_content += f"\n\nNote: {persist_failures} task(s) could not be saved to persistent storage."

        return {
            "content": response_content,
            "agent": self.name,
            "tasks": plan.get("tasks", []),
            "created_count": len(created_tasks),
            "persist_failures": persist_failures,
        }

    async def _persist_tasks_to_firestore(
        self, user_id: str, tasks: list[dict]
    ) -> int:
        """Persist planned tasks to Firestore.

        Args:
            user_id: The user ID to associate tasks with.
            tasks: List of task dictionaries from the plan.

        Returns:
            Number of tasks that failed to persist.
        """
        now = datetime.utcnow()
        failed_count = 0
        for task_item in tasks:
            try:
                due_days = task_item.get("due_days_from_now", 7)
                deadline = now + timedelta(days=due_days)
                task_model = TaskModel(
                    user_id=user_id,
                    title=task_item.get("title", ""),
                    description=task_item.get("notes", ""),
                    priority=task_item.get("priority", "medium"),
                    status="pending",
                    deadline=deadline,
                    created_at=now,
                    updated_at=now,
                )
                await TaskRepository.create(task_model)
            except Exception as e:
                failed_count += 1
                logger.warning(
                    "Failed to persist task '%s' for user '%s': %s",
                    task_item.get("title", "unknown"),
                    user_id,
                    str(e),
                )
        return failed_count

    async def _decompose_goal(self, goal: str) -> dict:
        """Use Gemini to break a goal into subtasks.

        Args:
            goal: The user's goal or objective to decompose.

        Returns:
            Plan dictionary with tasks, summary, and response.
        """
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=f"Break this goal into actionable tasks: {goal}",
                config={
                    "system_instruction": PLANNER_PROMPT,
                    "response_mime_type": "application/json",
                },
            )
            return json.loads(response.text)
        except Exception as e:
            return {
                "plan_summary": "Unable to create detailed plan",
                "tasks": [
                    {
                        "title": goal,
                        "notes": "Original goal - needs manual breakdown",
                        "due_days_from_now": 7,
                        "priority": "medium",
                    }
                ],
                "response": f"I'll help you plan '{goal}'. Let me create a task for this.",
            }

    async def list_tasks(self, auth_token: str) -> list[dict]:
        """List all tasks from Google Tasks.

        Args:
            auth_token: Google OAuth token for API access.

        Returns:
            List of task dictionaries.
        """
        if not self.mcp_client:
            return []

        try:
            result = await self.call_mcp_tool(
                "google-tasks", "list_tasks", {"auth_token": auth_token}
            )
            return result if isinstance(result, list) else []
        except Exception:
            return []
