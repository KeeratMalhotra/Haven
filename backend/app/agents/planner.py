"""Planner Agent - Task decomposition and management.

Breaks user goals into subtasks with deadlines using Vertex AI Gemini,
and manages tasks through the Google Tasks MCP server.
Persists created tasks to Firestore via TaskRepository.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings
from app.db.models import Task as TaskModel
from app.db.repositories import TaskRepository
from app.utils.timectx import time_context_string


logger = logging.getLogger(__name__)


PLANNER_PROMPT = """You are a task planning specialist. You either READ the user's existing tasks or CREATE new tasks. You must choose exactly one action (or ask for a missing deadline).

You will be given the CURRENT date and time. Use it to interpret deadlines like "by Friday" or "next week".

ACTION SELECTION RULES (read carefully - this is critical):
- READ intent -> action: "list_tasks". The user wants to SEE, VIEW, or CHECK tasks that already exist. They are NOT asking you to make anything. In this case you MUST NOT create any tasks; return an EMPTY "tasks" array.
  Examples of READ: "what tasks do I have today?", "show my tasks", "list my todos", "do I have anything due?", "what's on my to-do list?", "any tasks for me?", "what do I need to do today?"
- WRITE intent -> action: "create_tasks". The user explicitly wants to ADD or CREATE something, or asks you to break a goal into steps. Also triggered when the user STATES they have a deadline or deliverable (implicit write).
  Examples of WRITE: "add a task to call the dentist", "create a task: finish report by Friday", "remind me to buy milk", "help me plan a launch party", "I need to prepare for the interview", "I have a deadline Friday", "I have a report due next week", "there's a submission deadline on Monday"
- COMPLETE intent -> action: "complete_task". The user says they finished, completed, or are done with a task. The instruction starts with "complete_task:" or the user says "I finished X", "done with X", "mark X as done", "completed X".
  Examples of COMPLETE: "I finished the report", "done with buying groceries", "mark the dentist call as done", "completed the code review", "complete_task: buy milk"
- DECOMPOSE intent -> action: "decompose". The user wants to BREAK DOWN a task or goal into subtasks/steps. They say "break down", "decompose", "split into steps", "help me plan [specific task]", "what are the steps for".
  Examples of DECOMPOSE: "break down my presentation prep into steps", "decompose the project launch", "split the report into subtasks", "help me plan the wedding", "what steps do I need for the interview prep"
- When the user only wants to look at existing tasks, ALWAYS choose "list_tasks". Creating junk tasks for a read request is a serious error.
- When the user STATES they have a deadline or deliverable ("I have X due by Y", "there's a deadline on Y") -> action: "create_tasks". This IS a create request even though they didn't say "create" or "add". Create a single task with the appropriate deadline.
- For "create_tasks", create ONLY the tasks the user actually asked for. A single simple request = a single task. Only decompose into multiple subtasks when the user gives a broad goal that genuinely needs a plan. Never spam many tasks for a simple query.
- If the instruction starts with "Create task:" -> action: "create_tasks". Extract the title and deadline from the instruction.
- If the instruction starts with "complete_task:" -> action: "complete_task". Extract the task name from after the colon.

DEADLINE CLARIFICATION RULE:
- A simple errand with no implied urgency does NOT need a deadline. e.g. "add a task to call mom" -> just create it (the system picks a sensible default). Do NOT ask for a deadline here.
- BUT when the user clearly implies a time-bound deliverable WITHOUT giving the specific date ("I have a report due", "I need to submit the assignment soon", "there's a deadline coming up") -> action: "needs_info". Ask specifically WHEN it is due. Do NOT invent a deadline.

DECOMPOSE RULES:
- Break the goal into 3-5 actionable subtasks (MAXIMUM 6, never more)
- Each subtask should be specific, concrete, and completable in one sitting
- Include a time estimate for each subtask
- If the model generates more than 6 subtasks, keep only the 6 most important ones
- Return action "decompose" with the subtasks list

When action is "needs_info", respond with:
{
  "action": "needs_info",
  "question": "When is the report due?",
  "pending": {"title": "Finish report", "notes": ""},
  "awaiting": "deadline",
  "intent": "create"
}

Otherwise respond with a JSON object:
{
  "action": "list_tasks" | "create_tasks" | "complete_task" | "decompose",
  "plan_summary": "brief description of the plan (create_tasks/decompose only)",
  "task_name": "name of task to complete (complete_task only)",
  "tasks": [
    {
      "title": "task title",
      "notes": "additional details or instructions",
      "due_days_from_now": number_of_days,
      "priority": "high|medium|low",
      "time_estimate": "optional time estimate e.g. '30 min', '1 hour'"
    }
  ],
  "response": "A natural language summary to share with the user"
}

For "list_tasks", set "tasks" to [] — the actual tasks are fetched from the user's account, not generated by you.
Each created task should be specific, actionable, and completable in one sitting.
"""


class PlannerAgent(AgentBase):
    """Planner agent that decomposes goals into tasks.

    Uses Vertex AI Gemini for intelligent task decomposition and the Google Tasks
    MCP server for task CRUD operations.
    """

    name = "planner"
    description = "Breaks goals into subtasks with deadlines"
    capabilities = ["task_decomposition", "task_creation", "task_listing"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the planner with Vertex AI GenerativeModel.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel(settings.GEMINI_MODEL)

    async def execute(self, task: dict) -> dict:
        """Read existing tasks or create new ones, based on user intent.

        Args:
            task: Dict with 'message' (the goal or instruction),
                  'auth_token' for Google API access,
                  'user_id' for Firestore persistence.

        Returns:
            Dict with 'content' (plan description or task list), 'agent' name,
            'action' taken, and 'tasks' (list of created/planned/listed tasks).
        """
        message = task.get("message", "")
        auth_token = task.get("auth_token", "")
        user_id = task.get("user_id", "")
        pending_action = task.get("pending_action")

        # Completing a previously stored clarification (e.g. a missing deadline).
        if pending_action:
            plan = await self._complete_pending(message, pending_action)
        else:
            # Classify intent (READ vs WRITE) and, if writing, decompose the goal.
            plan = await self._analyze_request(message)

        action = plan.get("action", "create_tasks")

        # Clarification needed: ask the user instead of inventing a deadline.
        if action == "needs_info":
            pending = self._build_needs_info(plan)
            return {
                "content": pending["question"],
                "agent": self.name,
                "action": "needs_info",
                "tasks": [],
                "pending_action": pending,
            }

        # READ intent: list existing tasks, never create anything.
        if action == "list_tasks":
            tasks = await self.list_tasks(auth_token)
            return {
                "content": self._format_task_list(tasks),
                "agent": self.name,
                "action": "list_tasks",
                "tasks": tasks,
                "pending_action": None,
            }

        # COMPLETE intent: mark a task as done.
        if action == "complete_task":
            task_name = plan.get("task_name", "")
            if not task_name:
                # Try to extract from the message itself
                task_name = message.replace("complete_task:", "").strip()
            result = await self._complete_task(auth_token, task_name, user_id)
            return result

        # DECOMPOSE intent: break a goal into subtasks (max 6).
        if action == "decompose":
            return await self._decompose_task(plan, auth_token, user_id)

        # WRITE intent: create the requested task(s).
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
            # Learn recurring task types from what the user creates.
            await self._record_creation_observation(user_id, plan["tasks"])

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
            "action": "create_tasks",
            "tasks": plan.get("tasks", []),
            "created_count": len(created_tasks),
            "persist_failures": persist_failures,
            "pending_action": None,
        }

    @staticmethod
    def _format_task_list(tasks: list[dict]) -> str:
        """Format a list of Google Tasks into a clean bulleted summary.

        Args:
            tasks: List of task dicts (may contain an error entry).

        Returns:
            A friendly, human-readable string. Handles the empty state.
        """
        real_tasks = [t for t in tasks if isinstance(t, dict) and not t.get("error")]

        if not real_tasks:
            return "You have no tasks today — want me to add one?"

        lines = [f"You have {len(real_tasks)} task(s):"]
        for t in real_tasks:
            indicator = "✓" if t.get("completed") else "○"
            title = t.get("title") or "Untitled task"
            line = f"• {indicator} {title}"
            due = t.get("due") or ""
            if due:
                # Google Tasks due dates are ISO timestamps; show just the date.
                line += f" (due {due[:10]})"
            lines.append(line)
        return "\n".join(lines)

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

    async def _analyze_request(self, message: str) -> dict:
        """Classify the request as READ or WRITE and build a plan if writing.

        Args:
            message: The user's task-related message.

        Returns:
            Plan dictionary with 'action' ("list_tasks" | "create_tasks" |
            "needs_info"), and for writes, 'tasks', 'plan_summary', 'response'.
        """
        prompt = f"""{time_context_string()}

{PLANNER_PROMPT}

User request: {message}"""

        text = await self.generate(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            fallback="",
        )
        try:
            return json.loads(text)
        except Exception:
            # Safe fallback: when in doubt, READ rather than risk creating junk.
            return {
                "action": "list_tasks",
                "tasks": [],
                "response": "Let me pull up your tasks.",
            }

    def _build_needs_info(self, plan: dict) -> dict:
        """Build a JSON-serializable pending_action for a missing deadline."""
        partial = dict(plan.get("pending") or {})
        if not partial.get("title"):
            partial["title"] = "New task"
        awaiting = plan.get("awaiting") or "deadline"
        question = plan.get("question") or f'When is "{partial["title"]}" due?'
        return {
            "agent": self.name,
            "intent": plan.get("intent", "create"),
            "awaiting": awaiting,
            "question": question,
            "partial": partial,
        }

    async def _complete_pending(self, message: str, pending: dict) -> dict:
        """Merge the user's deadline answer into a pending task creation."""
        partial = dict(pending.get("partial") or {})
        question = pending.get("question", "")

        prompt = f"""{time_context_string()}

{PLANNER_PROMPT}

You previously asked the user: "{question}"
The task so far: {json.dumps(partial)}
The user just replied with the deadline: "{message}"

Produce the completed "create_tasks" action JSON with a single task that uses the
deadline from the reply (set due_days_from_now accordingly). If the reply does not
contain a usable deadline, return action "needs_info" again."""

        text = await self.generate(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            fallback="",
        )
        try:
            plan = json.loads(text)
            if isinstance(plan, dict) and plan.get("action"):
                return plan
        except Exception:
            pass

        # Fallback: create the task with the system default deadline so we never
        # get stuck, rather than inventing a specific date.
        title = partial.get("title", "New task")
        return {
            "action": "create_tasks",
            "tasks": [
                {
                    "title": title,
                    "notes": partial.get("notes", ""),
                    "due_days_from_now": 7,
                    "priority": partial.get("priority", "medium"),
                }
            ],
            "response": f'Added "{title}" to your tasks.',
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

    async def _decompose_task(self, plan: dict, auth_token: str, user_id: str) -> dict:
        """Break down a goal into actionable subtasks (max 6).

        Creates each subtask via MCP and returns a formatted list.

        Args:
            plan: The analyzed plan dict with 'tasks' from Gemini.
            auth_token: Google OAuth token.
            user_id: User ID for Firestore persistence.

        Returns:
            Response dict with decomposed subtasks.
        """
        subtasks = plan.get("tasks", [])

        # Enforce max 6 subtasks
        if len(subtasks) > 6:
            subtasks = subtasks[:6]

        # Create each subtask via MCP
        created_tasks = []
        if self.mcp_client and auth_token and subtasks:
            for task_item in subtasks:
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
                    pass

        # Persist to Firestore
        if user_id and subtasks:
            await self._persist_tasks_to_firestore(user_id, subtasks)

        # Format the response
        response_content = plan.get("response", "I've broken it down:")
        if subtasks:
            lines = [response_content]
            for i, task_item in enumerate(subtasks, 1):
                title = task_item.get("title", "Subtask")
                time_est = task_item.get("time_estimate", "")
                line = f"{i}. \u2610 {title}"
                if time_est:
                    line += f" ({time_est})"
                lines.append(line)
            response_content = "\n".join(lines)

        if created_tasks:
            response_content += f"\n\nCreated {len(created_tasks)} subtask(s) in your Google Tasks."

        return {
            "content": response_content,
            "agent": self.name,
            "action": "decompose",
            "tasks": subtasks,
            "created_count": len(created_tasks),
            "pending_action": None,
        }

    async def _complete_task(self, auth_token: str, task_name: str, user_id: str = "") -> dict:
        """Mark a task as completed by finding it by name and calling MCP.

        Lists all tasks, finds the best match for the given name, then
        calls the complete_task MCP tool.

        Args:
            auth_token: Google OAuth token for API access.
            task_name: The name/title of the task to complete.
            user_id: The user's ID, used to record a learning observation.

        Returns:
            Response dict with confirmation or error message.
        """
        if not task_name:
            return {
                "content": "Which task did you complete? Let me know the name.",
                "agent": self.name,
                "action": "complete_task",
                "tasks": [],
                "pending_action": None,
            }

        # List tasks to find the matching one
        tasks = await self.list_tasks(auth_token)
        if not tasks:
            return {
                "content": "I couldn't find any tasks to complete. Your task list appears to be empty.",
                "agent": self.name,
                "action": "complete_task",
                "tasks": [],
                "pending_action": None,
            }

        # Find the best matching task (case-insensitive substring match)
        task_name_lower = task_name.lower()
        matched_task = None
        for t in tasks:
            if not isinstance(t, dict):
                continue
            title = t.get("title", "")
            if title.lower() == task_name_lower:
                matched_task = t
                break
            if task_name_lower in title.lower():
                matched_task = t

        if not matched_task:
            return {
                "content": f"I couldn't find a task matching '{task_name}'. Check your task list and try again.",
                "agent": self.name,
                "action": "complete_task",
                "tasks": [],
                "pending_action": None,
            }

        # Call MCP complete_task tool
        task_id = matched_task.get("id", "")
        try:
            await self.call_mcp_tool(
                "google-tasks",
                "complete_task",
                {"auth_token": auth_token, "task_id": task_id},
            )
            task_title = matched_task.get("title", task_name)
            # Learn from the completion: record the time + title so memory can
            # infer productive hours and recurring task types. Best-effort.
            await self._record_completion_observation(user_id, task_title)
            return {
                "content": f"Done! Marked '{task_title}' as completed. Nice work!",
                "agent": self.name,
                "action": "complete_task",
                "tasks": [],
                "pending_action": None,
            }
        except Exception as e:
            logger.error(f"[planner] Failed to complete task: {e}")
            return {
                "content": f"I found the task '{matched_task.get('title', task_name)}' but couldn't mark it as complete. Please try again.",
                "agent": self.name,
                "action": "complete_task",
                "tasks": [],
                "pending_action": None,
            }

    @staticmethod
    async def _record_completion_observation(user_id: str, title: str) -> None:
        """Record a task-completion signal for behavioural learning.

        Best-effort and isolated: memory failures must never affect the
        user-facing task flow.
        """
        if not user_id:
            return
        try:
            from app.agents.memory import record_observation
            from app.utils.timectx import now_ist

            await record_observation(
                user_id,
                "task_completed",
                {"hour": now_ist().hour, "title": title},
            )
        except Exception as e:
            logger.warning(f"[planner] memory observation failed: {e}")

    @staticmethod
    async def _record_creation_observation(user_id: str, tasks: list[dict]) -> None:
        """Record task-creation signals so memory learns recurring task types."""
        if not user_id or not tasks:
            return
        try:
            from app.agents.memory import record_observation
            from app.utils.timectx import now_ist

            hour = now_ist().hour
            for t in tasks:
                title = t.get("title", "")
                if title:
                    await record_observation(
                        user_id, "task_created", {"hour": hour, "title": title}
                    )
        except Exception as e:
            logger.warning(f"[planner] memory creation observation failed: {e}")
