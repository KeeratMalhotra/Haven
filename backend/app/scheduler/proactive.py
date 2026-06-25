"""Proactive Scheduler - Background task for deadline monitoring and nudge delivery.

Periodically checks all users' tasks for approaching deadlines and sends
escalating notifications through the WebSocket connection manager.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.config import settings
from app.db.repositories import UserRepository, TaskRepository
from app.scheduler.nudge_engine import classify_urgency, generate_nudge, _format_time_remaining
from app.ws_manager import ConnectionManager

logger = logging.getLogger(__name__)


async def _check_user_deadlines(
    user_id: str, manager: ConnectionManager
) -> list[dict]:
    """Check a single user's tasks for approaching deadlines and send nudges.

    Args:
        user_id: The user ID to check tasks for.
        manager: ConnectionManager instance for pushing notifications.

    Returns:
        List of nudge summary dicts that were generated.
    """
    nudges_sent = []

    try:
        tasks = await TaskRepository.list_by_user(user_id)
    except Exception:
        logger.warning(f"Failed to fetch tasks for user {user_id}")
        return nudges_sent

    now = datetime.now(timezone.utc)

    for task in tasks:
        if not task.deadline:
            continue

        # Skip completed tasks
        if task.status in ("completed", "done"):
            continue

        deadline = task.deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        # Only process tasks with deadlines within 24 hours
        remaining = deadline - now
        if remaining > timedelta(hours=24) or remaining.total_seconds() <= 0:
            continue

        urgency = classify_urgency(deadline)
        time_remaining = _format_time_remaining(deadline)

        # Generate nudge message
        nudge_message = await generate_nudge(task.title, urgency, time_remaining)

        # Push notification to connected user
        notification = {
            "type": "notification",
            "content": nudge_message,
            "agent": "notification",
            "metadata": {
                "task_id": task.id,
                "task_title": task.title,
                "urgency": urgency,
                "time_remaining": time_remaining,
                "deadline": deadline.isoformat(),
            },
        }

        sent_count = await manager.send_to_user(user_id, notification)

        nudges_sent.append({
            "user_id": user_id,
            "task_title": task.title,
            "urgency": urgency,
            "time_remaining": time_remaining,
            "delivered": sent_count > 0,
        })

        logger.info(
            f"Nudge sent to user {user_id}: '{task.title}' "
            f"({urgency}, {time_remaining}), delivered to {sent_count} connections"
        )

    return nudges_sent


async def run_nudge_check(manager: ConnectionManager, user_id: Optional[str] = None) -> list[dict]:
    """Run a nudge check for all users or a specific user.

    Args:
        manager: ConnectionManager instance for pushing notifications.
        user_id: Optional specific user ID to check. If None, checks all users.

    Returns:
        List of all nudge summaries generated during this check.
    """
    all_nudges = []

    if user_id:
        nudges = await _check_user_deadlines(user_id, manager)
        all_nudges.extend(nudges)
    else:
        try:
            users = await UserRepository.list_all()
        except Exception:
            logger.error("Failed to fetch users for nudge check")
            return all_nudges

        for user in users:
            if not user.id:
                continue
            nudges = await _check_user_deadlines(user.id, manager)
            all_nudges.extend(nudges)

    return all_nudges


async def _scheduler_loop(manager: ConnectionManager) -> None:
    """Main scheduler loop that runs periodically.

    Args:
        manager: ConnectionManager instance for pushing notifications.
    """
    interval_seconds = settings.NUDGE_INTERVAL_MINUTES * 60
    logger.info(
        f"Proactive scheduler started. Checking every {settings.NUDGE_INTERVAL_MINUTES} minutes."
    )

    while True:
        try:
            await run_nudge_check(manager)
        except Exception:
            logger.exception("Error during proactive nudge check")

        await asyncio.sleep(interval_seconds)


def start_proactive_scheduler(manager: ConnectionManager) -> asyncio.Task:
    """Start the proactive scheduler as a background asyncio task.

    Args:
        manager: ConnectionManager instance for pushing notifications.

    Returns:
        The asyncio.Task running the scheduler loop.
    """
    task = asyncio.create_task(_scheduler_loop(manager))
    logger.info("Proactive scheduler task created.")
    return task


def stop_proactive_scheduler(task: asyncio.Task) -> None:
    """Stop the proactive scheduler background task.

    Args:
        task: The asyncio.Task to cancel.
    """
    task.cancel()
    logger.info("Proactive scheduler task cancelled.")
