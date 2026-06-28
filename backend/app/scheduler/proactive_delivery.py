"""Governance + delivery for proactive interventions.

This is the layer that decides — like a disciplined chief of staff — *whether*
and *how* to actually surface the interventions the intelligence engine
produces. The engine says "here's what I noticed"; this layer enforces the
rules that keep ChronAI respectful:

  - Frequency budget: at most N Tier 2+ nudges per user per day (calibrated by
    the user's own accept/dismiss history). Beyond that, everything is
    downgraded to ambient (it still reaches the morning briefing).
  - Never during focus mode: while a focus session is active, Tier 2 nudges are
    suppressed; only a true Tier 3 emergency may pass.
  - Quiet mode: a user preference that disables all proactive nudges.
  - Daily dedup: each intervention type fires at most once per day.
  - Always actionable + never lost: every delivered nudge is written to the
    notification inbox (and pushed over WebSocket when requested), so the user
    can always find it again.

Both the on-demand ``GET /api/proactive/check`` endpoint and the background
scheduler call :func:`deliver_interventions`, so governance behaves identically
no matter how the check is triggered.
"""

import logging
from typing import Any, Optional

from app.agents.proactive_intelligence import compute_interventions, _polish_messages
from app.db.models import Notification
from app.db.repositories import (
    NotificationRepository,
    ProactiveStateRepository,
    UserRepository,
)
from app.utils.timectx import now_ist
from app.ws_manager import ConnectionManager

logger = logging.getLogger(__name__)

# Base number of Tier 2+ nudges allowed per day before everything is downgraded.
_BASE_DAILY_BUDGET = 3
# Calibration only kicks in once we have at least this much feedback signal.
_CALIBRATION_MIN_SAMPLES = 5


def _effective_budget(accepted: int, dismissed: int) -> int:
    """Compute today's nudge budget, calibrated by the user's own feedback.

    If the user dismisses most nudges, we pull back hard (the worst thing we can
    be is annoying). If they act on most of them, we allow a little more room.
    """
    total = accepted + dismissed
    if total < _CALIBRATION_MIN_SAMPLES:
        return _BASE_DAILY_BUDGET
    dismiss_rate = dismissed / total
    accept_rate = accepted / total
    if dismiss_rate > 0.6:
        return 1
    if accept_rate > 0.5:
        return _BASE_DAILY_BUDGET + 1
    return _BASE_DAILY_BUDGET


async def _quiet_mode(user_id: str) -> bool:
    """Return True if the user has disabled proactive nudges entirely."""
    try:
        user = await UserRepository.get_by_id(user_id)
        if user:
            return bool(user.preferences.get("proactive_quiet", False))
    except Exception:
        pass
    return False


async def deliver_interventions(
    user_id: str,
    auth_token: str,
    mcp_client: Any,
    *,
    manager: Optional[ConnectionManager] = None,
    push: bool = False,
    focus_override: Optional[bool] = None,
) -> list[dict]:
    """Compute, govern, persist and (optionally) push proactive interventions.

    Args:
        user_id: The user's ID.
        auth_token: Google OAuth token for MCP calls.
        mcp_client: MCP client instance (may be None).
        manager: Connection manager for WebSocket push (required when push=True).
        push: When True, also push each delivered nudge over WebSocket.
        focus_override: If provided, overrides the stored focus state for this
            call (the frontend can pass the live focus flag).

    Returns:
        A list of delivered notifications as JSON-ready dicts (newest-first),
        each carrying its persisted inbox ``id`` so the client can mark it read
        or record feedback. Returns an empty list when governance suppresses
        everything. Never raises.
    """
    if not user_id:
        return []

    try:
        # Compute with deterministic copy first — polishing is deferred until we
        # know something will actually be delivered, so we never pay the Gemini
        # cost on a check that governance will fully suppress.
        interventions = await compute_interventions(
            user_id, auth_token, mcp_client, polish=False
        )
    except Exception as e:
        logger.warning(f"[proactive] compute failed for {user_id}: {e}")
        return []
    if not interventions:
        return []

    today = now_ist().strftime("%Y-%m-%d")

    try:
        state = await ProactiveStateRepository.get(user_id)
    except Exception:
        return []

    # Roll the daily counters over at the start of a new day.
    if state.date != today:
        state.date = today
        state.nudge_count = 0
        state.last_fired = {}

    quiet = await _quiet_mode(user_id)
    focus_active = (
        focus_override if focus_override is not None else state.focus_active
    )
    budget = _effective_budget(state.accepted, state.dismissed)

    # --- Governance: select what passes before paying for any copy polish. ---
    selected: list[dict] = []
    projected_count = state.nudge_count
    for iv in interventions:  # already sorted most-urgent-first
        tier = iv["tier"]
        itype = iv["type"]

        # Tier 1 is ambient — it belongs in the briefing, never as a toast.
        if tier <= 1:
            continue
        # Quiet mode disables all proactive nudges.
        if quiet:
            continue
        # Never interrupt a focus session, except a genuine Tier 3 emergency.
        if focus_active and tier < 3:
            continue
        # Daily dedup: this observation already fired today.
        if state.last_fired.get(itype) == today:
            continue
        # Frequency budget: beyond it, downgrade to ambient (briefing only).
        if tier < 3 and projected_count >= budget:
            continue

        selected.append(iv)
        if tier < 3:
            projected_count += 1

    if not selected:
        # Nothing to deliver — persist any day-rollover and stop.
        try:
            await ProactiveStateRepository.save(state)
        except Exception:
            pass
        return []

    # Now (and only now) refine the copy for the few we're about to surface.
    try:
        selected = await _polish_messages(selected)
    except Exception:
        pass

    delivered: list[dict] = []
    for iv in selected:
        itype = iv["type"]
        tier = iv["tier"]

        notification = Notification(
            user_id=user_id,
            title=iv.get("title", "A gentle nudge"),
            message=iv["message"],
            type="proactive",
            tier=tier,
            source=itype,
            action=iv.get("action"),
        )
        try:
            await NotificationRepository.create(notification)
        except Exception as e:
            logger.warning(f"[proactive] failed to persist notification: {e}")
            continue

        state.nudge_count += 1
        state.last_fired[itype] = today

        payload = notification.model_dump(mode="json")
        delivered.append(payload)

        if push and manager is not None:
            try:
                await manager.send_to_user(
                    user_id,
                    {
                        "type": "notification",
                        "content": notification.message,
                        "agent": "proactive",
                        "metadata": {
                            "notification_id": notification.id,
                            "title": notification.title,
                            "tier": tier,
                            "source": itype,
                            "urgency": "critical" if tier >= 3 else "info",
                            "action": notification.action,
                        },
                    },
                )
            except Exception as e:
                logger.warning(f"[proactive] websocket push failed: {e}")

    try:
        await ProactiveStateRepository.save(state)
        await NotificationRepository.prune(user_id)
    except Exception:
        pass

    return delivered
