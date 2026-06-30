"""Tests for the EMAIL deadline-reminder dedup (anti-spam) behavior.

The proactive scheduler used to re-send the same deadline reminder email on
every pass (every ~10 min) for as long as a task sat inside its notification
window and the user was offline. These tests pin the new behavior: each task
escalation milestone (``gentle`` / ``urgent`` / ``critical``) and the dedicated
~4h reminder email fire AT MOST ONCE per task, the dedup state is persisted in
the ``reminder_state`` collection, and entries are cleaned up once a task is
completed or its deadline passes.

All Gmail/Gemini calls are mocked so these run offline.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db.models import ReminderState
from app.db.repositories import ReminderStateRepository
from app.scheduler.proactive import _check_user_deadlines


def _offline_manager() -> MagicMock:
    """A ConnectionManager mock where the user is NOT connected (email path)."""
    manager = MagicMock()
    manager.send_to_user = AsyncMock(return_value=0)
    manager.is_connected = MagicMock(return_value=False)
    return manager


def _seed_user(db, user_id="user123", prefs=None):
    prefs = prefs or {
        "email_notifications": True,
        "email_for_urgent_only": False,
        "email_deadline_reminders": True,
    }
    db._data.setdefault("users", {})[user_id] = {
        "email": "test@example.com",
        "name": "Test User",
        "google_tokens": {"access_token": "token123", "refresh_token": "refresh456"},
        "connected_services": {},
        "notification_preferences": prefs,
        "preferences": {},
        "profile": {
            "role": "", "occupation": "", "work_hours_start": 9,
            "work_hours_end": 18, "wake_time": 7, "sleep_time": 23,
            "priorities": [], "daily_routine": "", "goals": [],
            "onboarding_complete": False,
        },
        "created_at": datetime.utcnow().isoformat(),
    }


def _seed_task(db, task_id, hours_from_now, user_id="user123", status="pending"):
    deadline = datetime.now(timezone.utc) + timedelta(hours=hours_from_now)
    db._data.setdefault("tasks", {})[task_id] = {
        "user_id": user_id,
        "title": f"Task {task_id}",
        "description": "",
        "subtasks": [],
        "priority": "high",
        "status": status,
        "deadline": deadline.isoformat(),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# WS-offline fallback nudge email dedup
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_nudge_email_sent_once_per_milestone(mock_firestore_db):
    """The same urgency milestone must email exactly once across many passes."""
    _seed_user(mock_firestore_db)
    _seed_task(mock_firestore_db, "task1", hours_from_now=2)  # "urgent" band

    manager = _offline_manager()

    with patch("app.scheduler.proactive._send_nudge_email", new_callable=AsyncMock) as send_email:
        send_email.return_value = True

        # First pass sends the email...
        nudges = await _check_user_deadlines("user123", manager)
        assert nudges[0]["email_sent"] is True
        assert send_email.call_count == 1

        # ...subsequent passes (still in the same band) must NOT resend.
        for _ in range(5):
            nudges = await _check_user_deadlines("user123", manager)
            assert nudges[0]["email_sent"] is False
        assert send_email.call_count == 1

    # Dedup state was persisted with the urgent milestone recorded.
    state = await ReminderStateRepository.get("user123")
    assert "urgent" in state.sent_milestones.get("task1", [])


@pytest.mark.asyncio
async def test_nudge_email_escalates_across_bands(mock_firestore_db):
    """A new band (gentle -> urgent -> critical) is allowed to email once each."""
    _seed_user(mock_firestore_db)
    _seed_task(mock_firestore_db, "task1", hours_from_now=10)  # "gentle" band

    manager = _offline_manager()

    with patch("app.scheduler.proactive._send_nudge_email", new_callable=AsyncMock) as send_email:
        send_email.return_value = True

        # gentle band fires once
        await _check_user_deadlines("user123", manager)
        assert send_email.call_count == 1

        # Move the deadline into the urgent band -> a different milestone fires.
        _seed_task(mock_firestore_db, "task1", hours_from_now=2)
        await _check_user_deadlines("user123", manager)
        assert send_email.call_count == 2

        # Move into the critical band -> fires once more.
        _seed_task(mock_firestore_db, "task1", hours_from_now=0.5)
        await _check_user_deadlines("user123", manager)
        assert send_email.call_count == 3

    state = await ReminderStateRepository.get("user123")
    milestones = state.sent_milestones.get("task1", [])
    assert {"gentle", "urgent", "critical"}.issubset(set(milestones))


@pytest.mark.asyncio
async def test_failed_send_is_retried_next_pass(mock_firestore_db):
    """A failed send must NOT be recorded, so the next pass retries it."""
    _seed_user(mock_firestore_db)
    _seed_task(mock_firestore_db, "task1", hours_from_now=2)

    manager = _offline_manager()

    with patch("app.scheduler.proactive._send_nudge_email", new_callable=AsyncMock) as send_email:
        send_email.return_value = False  # delivery fails
        await _check_user_deadlines("user123", manager)
        assert send_email.call_count == 1

        # Nothing recorded because the send failed.
        state = await ReminderStateRepository.get("user123")
        assert "urgent" not in state.sent_milestones.get("task1", [])

        # Next pass retries; this time it succeeds.
        send_email.return_value = True
        await _check_user_deadlines("user123", manager)
        assert send_email.call_count == 2

    state = await ReminderStateRepository.get("user123")
    assert "urgent" in state.sent_milestones.get("task1", [])


# ---------------------------------------------------------------------------
# Dedicated 4-hour reminder email dedup
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_four_hour_reminder_fires_once(mock_firestore_db):
    """The ~4h reminder must collapse its hour-wide window to a single send."""
    _seed_user(mock_firestore_db)
    _seed_task(mock_firestore_db, "task1", hours_from_now=4)  # inside 3h30-4h30

    manager = _offline_manager()

    with patch("app.scheduler.proactive.send_task_reminder", new_callable=AsyncMock) as reminder, \
         patch("app.scheduler.proactive._send_nudge_email", new_callable=AsyncMock) as nudge:
        reminder.return_value = True
        nudge.return_value = True

        # Many passes while the task sits in the 4h window.
        for _ in range(6):
            await _check_user_deadlines("user123", manager)

        # The dedicated reminder fired exactly once despite 6 passes.
        assert reminder.call_count == 1

    state = await ReminderStateRepository.get("user123")
    assert "deadline_4h" in state.sent_milestones.get("task1", [])


@pytest.mark.asyncio
async def test_four_hour_reminder_respects_preference(mock_firestore_db):
    """When email_deadline_reminders is False, the 4h reminder is not sent."""
    _seed_user(
        mock_firestore_db,
        prefs={
            "email_notifications": True,
            "email_for_urgent_only": False,
            "email_deadline_reminders": False,
        },
    )
    _seed_task(mock_firestore_db, "task1", hours_from_now=4)

    manager = _offline_manager()

    with patch("app.scheduler.proactive.send_task_reminder", new_callable=AsyncMock) as reminder, \
         patch("app.scheduler.proactive._send_nudge_email", new_callable=AsyncMock) as nudge:
        nudge.return_value = True
        await _check_user_deadlines("user123", manager)
        reminder.assert_not_called()

    state = await ReminderStateRepository.get("user123")
    assert "deadline_4h" not in state.sent_milestones.get("task1", [])


# ---------------------------------------------------------------------------
# Cleanup / pruning
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dedup_state_pruned_when_task_completed(mock_firestore_db):
    """Completing a task removes its dedup entry so the store stays bounded."""
    _seed_user(mock_firestore_db)
    _seed_task(mock_firestore_db, "task1", hours_from_now=2)

    manager = _offline_manager()

    with patch("app.scheduler.proactive._send_nudge_email", new_callable=AsyncMock) as send_email:
        send_email.return_value = True
        await _check_user_deadlines("user123", manager)

    state = await ReminderStateRepository.get("user123")
    assert "task1" in state.sent_milestones

    # Mark the task completed; the next pass should prune the dedup entry.
    mock_firestore_db._data["tasks"]["task1"]["status"] = "completed"
    await _check_user_deadlines("user123", manager)

    state = await ReminderStateRepository.get("user123")
    assert "task1" not in state.sent_milestones


@pytest.mark.asyncio
async def test_dedup_state_pruned_when_deadline_passed(mock_firestore_db):
    """A past-deadline task has its dedup entry pruned."""
    _seed_user(mock_firestore_db)
    _seed_task(mock_firestore_db, "task1", hours_from_now=2)

    manager = _offline_manager()
    with patch("app.scheduler.proactive._send_nudge_email", new_callable=AsyncMock) as send_email:
        send_email.return_value = True
        await _check_user_deadlines("user123", manager)

    assert "task1" in (await ReminderStateRepository.get("user123")).sent_milestones

    # Move the deadline into the past.
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    mock_firestore_db._data["tasks"]["task1"]["deadline"] = past.isoformat()
    await _check_user_deadlines("user123", manager)

    assert "task1" not in (await ReminderStateRepository.get("user123")).sent_milestones


@pytest.mark.asyncio
async def test_preexisting_state_blocks_resend(mock_firestore_db):
    """If a milestone was already recorded, no email is sent for it again."""
    _seed_user(mock_firestore_db)
    _seed_task(mock_firestore_db, "task1", hours_from_now=2)  # urgent band

    # Pre-seed the dedup state as if the urgent email already went out.
    await ReminderStateRepository.save(
        ReminderState(user_id="user123", sent_milestones={"task1": ["urgent"]})
    )

    manager = _offline_manager()
    with patch("app.scheduler.proactive._send_nudge_email", new_callable=AsyncMock) as send_email:
        send_email.return_value = True
        nudges = await _check_user_deadlines("user123", manager)
        send_email.assert_not_called()
        assert nudges[0]["email_sent"] is False
