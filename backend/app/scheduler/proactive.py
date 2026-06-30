"""Proactive Scheduler - Background task for deadline monitoring and nudge delivery.

Periodically checks all users' tasks for approaching deadlines and sends
escalating notifications through the WebSocket connection manager.
Falls back to email when the user is not connected via WebSocket.
Also runs daily digest and weekly review email jobs.
"""

import asyncio
import base64
import html as html_mod
import logging
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.config import settings
from app.db.firestore import get_db
from app.db.repositories import UserRepository, TaskRepository, ReminderStateRepository
from app.scheduler.nudge_engine import classify_urgency, generate_nudge, _format_time_remaining
from app.utils.email_notifications import send_task_reminder, send_daily_digest, send_weekly_review
from app.ws_manager import ConnectionManager

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# Firestore collection for scheduler state persistence
_SCHEDULER_STATE_COLLECTION = "scheduler_state"
_SCHEDULER_STATE_DOC = "timestamps"

# Dedup milestone key for the dedicated "deadline approaching" reminder email
# (the hour-wide ~4h-out window). It is tracked separately from the escalation
# band milestones ("gentle"/"urgent"/"critical") used by the WS-offline nudge
# fallback email, so each of those emails fires at most once per task.
_MILESTONE_DEADLINE_4H = "deadline_4h"


async def _get_last_run(field: str) -> Optional[datetime]:
    """Get a last-run timestamp from Firestore scheduler state.

    Args:
        field: The field name (e.g. 'last_daily_digest', 'last_weekly_review').

    Returns:
        The datetime value or None if not set.
    """
    try:
        db = get_db()
        doc = await db.collection(_SCHEDULER_STATE_COLLECTION).document(_SCHEDULER_STATE_DOC).get()
        if doc.exists:
            data = doc.to_dict()
            val = data.get(field)
            if val is not None:
                if isinstance(val, datetime):
                    if val.tzinfo is None:
                        return val.replace(tzinfo=timezone.utc)
                    return val
        return None
    except Exception as e:
        logger.warning(f"Failed to read scheduler state for '{field}': {e}")
        return None


async def _set_last_run(field: str, value: datetime) -> None:
    """Persist a last-run timestamp to Firestore scheduler state.

    Args:
        field: The field name to update.
        value: The datetime value to persist.
    """
    try:
        db = get_db()
        doc_ref = db.collection(_SCHEDULER_STATE_COLLECTION).document(_SCHEDULER_STATE_DOC)
        await doc_ref.set({field: value}, merge=True)
    except Exception as e:
        logger.warning(f"Failed to persist scheduler state for '{field}': {e}")


async def _send_nudge_email(user_email: str, nudge_message: str, task_title: str, google_tokens: dict) -> bool:
    """Send a nudge email to the user via Gmail API.

    Uses the user's stored refresh token to obtain fresh credentials and
    sends an HTML email with Haven branding.

    Args:
        user_email: The user's email address.
        nudge_message: The nudge text to include in the email.
        task_title: The task title for the email subject.
        google_tokens: The user's stored Google OAuth tokens.

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    try:
        access_token = google_tokens.get("access_token", "")
        refresh_token = google_tokens.get("refresh_token", "")

        if not access_token and not refresh_token:
            logger.warning("No tokens available to send nudge email")
            return False

        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            token_uri="https://oauth2.googleapis.com/token",
        )

        service = build("gmail", "v1", credentials=credentials)

        # Build HTML email with Haven branding
        safe_nudge = html_mod.escape(nudge_message)
        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
    .card {{ background-color: #16213e; border-radius: 12px; padding: 32px; border: 1px solid #0f3460; }}
    .logo {{ color: #e94560; font-size: 24px; font-weight: bold; margin-bottom: 24px; }}
    .message {{ color: #eaeaea; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }}
    .task-title {{ color: #ffffff; font-weight: 600; }}
    .btn {{ display: inline-block; background-color: #e94560; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; }}
    .footer {{ color: #666; font-size: 12px; margin-top: 24px; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">Haven</div>
      <div class="message">
        <p>{safe_nudge}</p>
      </div>
      <a href="{settings.FRONTEND_ORIGIN}" class="btn">Open Haven</a>
    </div>
    <div class="footer">
      <p>You received this because you have email notifications enabled in Haven.</p>
    </div>
  </div>
</body>
</html>"""

        msg = MIMEMultipart("alternative")
        msg["to"] = user_email
        msg["subject"] = f"Haven Reminder: {task_title}"
        msg.attach(MIMEText(nudge_message, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

        service.users().messages().send(
            userId="me", body={"raw": raw}
        ).execute()

        logger.info(f"Nudge email sent to {user_email} for task '{task_title}'")
        return True
    except Exception as e:
        logger.error(
            "Failed to send nudge email to %s for task '%s': [%s] %s",
            user_email,
            task_title,
            type(e).__name__,
            e,
            exc_info=True,
        )
        return False


async def _check_user_deadlines(
    user_id: str, manager: ConnectionManager
) -> list[dict]:
    """Check a single user's tasks for approaching deadlines and send nudges.

    When the user is connected via WebSocket, pushes notifications directly.
    When the user is offline, falls back to sending a Gmail email (respecting
    the user's notification_preferences).

    Email deadline reminders are governed by per-(task, milestone) dedup so the
    same reminder never spams on every scheduler pass. Each task escalates
    through discrete milestones based on time remaining and emails AT MOST ONCE
    PER MILESTONE:

      - ``gentle``      : deadline within ~24h (and > 6h)
      - ``urgent``      : within ~6h (and > 1h)
      - ``critical``    : within ~1h
      - ``deadline_4h`` : the dedicated reminder email for the ~4h-out window

    The dedup state lives in the ``reminder_state`` Firestore collection
    (one doc per user). Entries for completed or past-deadline tasks are pruned
    each pass so the document never grows unbounded.

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

    # Load the per-user email dedup state once for this pass. Degrades to a
    # fresh (empty) state on any read error so the scheduler never breaks.
    reminder_state = await ReminderStateRepository.get(user_id)
    state_dirty = False
    # Tasks that are still relevant (not completed, deadline in the future);
    # anything else has its dedup entries pruned at the end of the pass.
    active_task_ids: set[str] = set()

    now = datetime.now(timezone.utc)

    for task in tasks:
        if not task.deadline:
            continue

        # Skip completed tasks (their dedup entries get pruned below).
        if task.status in ("completed", "done"):
            continue

        deadline = task.deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        remaining = deadline - now

        # A past-deadline task is no longer active; skip it so its dedup
        # entries are pruned and never resent.
        if remaining.total_seconds() <= 0:
            continue

        # The task is active (not completed, future deadline). Keep its dedup
        # state even if it is currently outside the 24h notification window.
        active_task_ids.add(task.id)

        # Only process tasks with deadlines within 24 hours.
        if remaining > timedelta(hours=24):
            continue

        urgency = classify_urgency(deadline)
        time_remaining = _format_time_remaining(deadline)

        # The escalation milestone for the WS-offline nudge fallback email is
        # the current urgency band; each band emails at most once per task.
        milestone = urgency
        sent_for_task = reminder_state.sent_milestones.get(task.id, [])

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

        # If user is NOT connected via WebSocket, try sending email — but only
        # once per escalation milestone (the dedup that stops the spam).
        email_sent = False
        user = None
        if not manager.is_connected(user_id):
            try:
                user = await UserRepository.get_by_id(user_id)
                if user and user.email:
                    # Gmail token is in connected_services.gmail (incremental OAuth)
                    gmail_tokens = user.connected_services.get("gmail", {})
                    tokens = gmail_tokens if gmail_tokens.get("access_token") else user.google_tokens
                    if tokens:
                        prefs = user.notification_preferences
                        email_enabled = prefs.get("email_notifications", True)
                        urgent_only = prefs.get("email_for_urgent_only", False)

                        # Respect notification preferences AND the per-milestone
                        # dedup: never resend a milestone already emailed.
                        should_send = (
                            email_enabled
                            and (not urgent_only or urgency in ("critical", "urgent"))
                            and milestone not in sent_for_task
                        )

                        if should_send:
                            email_sent = await _send_nudge_email(
                                user.email, nudge_message, task.title, tokens
                            )
                            if email_sent:
                                reminder_state.sent_milestones.setdefault(
                                    task.id, []
                                ).append(milestone)
                                state_dirty = True
            except Exception as e:
                logger.error(f"Error sending email fallback for user {user_id}: {e}")

        # Dedicated deadline reminder email for the ~4h-out window. The window
        # is intentionally an hour wide (3h30m–4h30m) to tolerate scheduler
        # interval timing; the dedup collapses it to a SINGLE send per task.
        if (
            timedelta(hours=3, minutes=30) <= remaining <= timedelta(hours=4, minutes=30)
            and _MILESTONE_DEADLINE_4H not in reminder_state.sent_milestones.get(task.id, [])
        ):
            try:
                if user is None:
                    user = await UserRepository.get_by_id(user_id)
                if user and user.email:
                    gmail_tokens = user.connected_services.get("gmail", {})
                    tokens = gmail_tokens if gmail_tokens.get("access_token") else user.google_tokens
                    if tokens and tokens.get("access_token"):
                        prefs = user.notification_preferences
                        if prefs.get("email_deadline_reminders", True):
                            deadline_str = deadline.strftime("%I:%M %p UTC")
                            reminder_ok = await send_task_reminder(
                                user.email, task.title, deadline_str, tokens
                            )
                            if reminder_ok:
                                reminder_state.sent_milestones.setdefault(
                                    task.id, []
                                ).append(_MILESTONE_DEADLINE_4H)
                                state_dirty = True
                                logger.info(
                                    f"4-hour deadline reminder sent to {user.email} "
                                    f"for '{task.title}'"
                                )
            except Exception as e:
                logger.error(f"Error sending 4-hour deadline email for user {user_id}: {e}")

        nudges_sent.append({
            "user_id": user_id,
            "task_title": task.title,
            "urgency": urgency,
            "time_remaining": time_remaining,
            "delivered": sent_count > 0,
            "email_sent": email_sent,
        })

        logger.info(
            f"Nudge sent to user {user_id}: '{task.title}' "
            f"({urgency}, {time_remaining}), delivered to {sent_count} connections, "
            f"email_sent={email_sent}"
        )

    # Prune dedup entries for tasks that are completed, deleted, or whose
    # deadline has passed so the per-user document never grows unbounded.
    stale_task_ids = [
        tid for tid in reminder_state.sent_milestones if tid not in active_task_ids
    ]
    for tid in stale_task_ids:
        del reminder_state.sent_milestones[tid]
        state_dirty = True

    if state_dirty:
        try:
            await ReminderStateRepository.save(reminder_state)
        except Exception as e:
            logger.warning(f"Failed to persist reminder dedup state for {user_id}: {e}")

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


async def _run_proactive_pass(manager: ConnectionManager) -> None:
    """Run the Sprint 12 proactive intelligence pass for all users.

    For each user, the intelligence engine computes interventions and the
    governance layer decides what (if anything) to surface. Anything delivered
    is persisted to the notification inbox and pushed over WebSocket. Genuinely
    time-sensitive Tier 3 nudges fall back to email when the user is offline.

    The engine relies on real tasks/calendar via MCP, which needs the user's
    OAuth token; for background runs we use the stored access token.
    """
    from app.scheduler.proactive_delivery import deliver_interventions

    # Late import keeps the global mcp_client lookup out of module import time.
    try:
        from app.main import mcp_client
    except Exception:
        mcp_client = None

    try:
        users = await UserRepository.list_all()
    except Exception:
        logger.error("Failed to fetch users for proactive pass")
        return

    for user in users:
        if not user.id:
            continue
        auth_token = (user.google_tokens or {}).get("access_token", "")
        if not auth_token:
            # Without a valid token we can't read the user's real schedule.
            continue
        try:
            delivered = await deliver_interventions(
                user.id,
                auth_token,
                mcp_client,
                manager=manager,
                push=True,
            )
        except Exception as e:
            logger.warning(f"Proactive pass failed for user {user.id}: {e}")
            continue

        # Tier 3 (active, rare) interventions reach an offline user via email.
        if delivered and not manager.is_connected(user.id):
            if user.email and user.google_tokens:
                for iv in delivered:
                    if iv.get("tier", 2) >= 3:
                        try:
                            await _send_nudge_email(
                                user.email,
                                iv.get("message", ""),
                                iv.get("title", "Haven"),
                                user.google_tokens,
                            )
                        except Exception as e:
                            logger.error(
                                f"Failed to email Tier 3 nudge to {user.email}: {e}"
                            )


async def _run_daily_digest() -> None:
    """Run the daily digest email job.

    Checks if roughly 24 hours have passed since the last run (persisted in Firestore).
    If so, iterates all users with 'daily_digest' enabled in their notification_preferences,
    fetches their pending tasks, and sends a daily digest email.
    """
    now = datetime.now(timezone.utc)

    # Only run once per 24 hours - check Firestore for last run
    last_run = await _get_last_run("last_daily_digest")
    if last_run is not None:
        elapsed = now - last_run
        if elapsed < timedelta(hours=23):
            return

    await _set_last_run("last_daily_digest", now)
    logger.info("Running daily digest job")

    try:
        users = await UserRepository.list_all()
    except Exception:
        logger.error("Failed to fetch users for daily digest")
        return

    for user in users:
        if not user.id or not user.email:
            continue

        gmail_tokens = user.connected_services.get("gmail", {})
        tokens = gmail_tokens if gmail_tokens.get("access_token") else user.google_tokens
        if not tokens or not tokens.get("access_token"):
            continue

        prefs = user.notification_preferences
        if not prefs.get("daily_digest", False):
            continue

        try:
            # Fetch user tasks
            tasks = await TaskRepository.list_by_user(user.id)
            pending_tasks = [
                {"title": t.title, "due": t.deadline.strftime("%b %d") if t.deadline else ""}
                for t in tasks
                if t.status not in ("completed", "done")
            ]

            # Events: try to fetch via calendar but skip if unavailable
            events: list[dict] = []

            await send_daily_digest(
                user.email, pending_tasks, events, tokens
            )
        except Exception as e:
            logger.error(f"Error sending daily digest for user {user.id}: {e}")


async def _run_weekly_review() -> None:
    """Run the weekly review email job.

    Checks if roughly 7 days have passed since the last run (persisted in Firestore).
    If so, iterates all users with 'weekly_review' enabled in their notification_preferences,
    generates a weekly review via the ReviewAgent, and sends the email.
    """
    now = datetime.now(timezone.utc)

    # Only run once per 7 days - check Firestore for last run
    last_run = await _get_last_run("last_weekly_review")
    if last_run is not None:
        elapsed = now - last_run
        if elapsed < timedelta(days=6, hours=20):
            return

    await _set_last_run("last_weekly_review", now)
    logger.info("Running weekly review job")

    try:
        users = await UserRepository.list_all()
    except Exception:
        logger.error("Failed to fetch users for weekly review")
        return

    for user in users:
        if not user.id or not user.email:
            continue

        gmail_tokens = user.connected_services.get("gmail", {})
        tokens = gmail_tokens if gmail_tokens.get("access_token") else user.google_tokens
        if not tokens or not tokens.get("access_token"):
            continue

        prefs = user.notification_preferences
        if not prefs.get("weekly_review", False):
            continue

        try:
            from app.agents.review import generate_weekly_review as gen_review

            auth_token = tokens.get("access_token", "")
            review_content = await gen_review(user.id, auth_token, mcp_client=None)

            await send_weekly_review(
                user.email, review_content, tokens
            )
        except Exception as e:
            logger.error(f"Error sending weekly review for user {user.id}: {e}")


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

        # Sprint 12: run the proactive intelligence pass (the "perfect nudge").
        try:
            await _run_proactive_pass(manager)
        except Exception:
            logger.exception("Error during proactive intelligence pass")

        # Run daily digest and weekly review jobs
        try:
            await _run_daily_digest()
        except Exception:
            logger.exception("Error during daily digest job")

        try:
            await _run_weekly_review()
        except Exception:
            logger.exception("Error during weekly review job")

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
