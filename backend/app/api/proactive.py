"""Proactive intelligence API router.

Exposes the chief-of-staff reasoning to the frontend:

  GET  /api/proactive/check     - compute + govern the current interventions,
                                  persist any Tier 2+ nudges to the inbox, and
                                  return the ones that should surface now.
  POST /api/proactive/focus     - tell the backend a focus session started or
                                  ended so nudges are suppressed accordingly.
  POST /api/proactive/feedback  - record that the user accepted or dismissed a
                                  nudge, which calibrates future frequency.

The check endpoint is safe to poll (on dashboard load and periodically): daily
dedup + the frequency budget ensure the same observation never nudges twice.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.auth import verify_google_token
from app.db.repositories import NotificationRepository, ProactiveStateRepository
from app.scheduler.proactive_delivery import deliver_interventions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/proactive", tags=["proactive"])


def _extract_token(auth_token: Optional[str], authorization: Optional[str]) -> str:
    """Resolve a bearer token from a query param or Authorization header."""
    token = auth_token
    if not token and authorization:
        token = (
            authorization[7:]
            if authorization.startswith("Bearer ")
            else authorization
        )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return token


class FocusBody(BaseModel):
    """Request body for toggling the focus-session suppression flag."""

    auth_token: str
    active: bool


class FeedbackBody(BaseModel):
    """Request body for recording accept/dismiss feedback on a nudge."""

    auth_token: str
    accepted: bool
    notification_id: Optional[str] = None


@router.get("/check")
async def proactive_check(
    request: Request,
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
    focus_active: Optional[bool] = Query(default=None),
):
    """Compute the current interventions and return the ones to surface now.

    Tier 2+ interventions that pass governance are persisted to the inbox and
    returned so the client can show them as gentle toasts. Tier 1 ambient notes
    are intentionally withheld here — they belong in the morning briefing.
    """
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    mcp_client = getattr(request.app.state, "mcp_client", None)

    delivered = await deliver_interventions(
        user_id,
        token,
        mcp_client,
        manager=None,
        push=False,
        focus_override=focus_active,
    )
    return {"interventions": delivered}


@router.post("/focus")
async def set_focus(body: FocusBody):
    """Record whether the user is currently in a focus session.

    While focus is active, Tier 2 nudges are suppressed so the user is never
    interrupted mid-flow.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    user_info = await verify_google_token(body.auth_token)
    user_id = user_info["sub"]

    await ProactiveStateRepository.set_focus_active(user_id, body.active)
    return {"status": "ok", "focus_active": body.active}


@router.post("/feedback")
async def record_feedback(body: FeedbackBody):
    """Record accept/dismiss feedback so future nudge frequency self-calibrates.

    When a notification id is supplied, the notification is also marked read.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    user_info = await verify_google_token(body.auth_token)
    user_id = user_info["sub"]

    state = await ProactiveStateRepository.record_feedback(user_id, body.accepted)
    if body.notification_id:
        try:
            await NotificationRepository.mark_read(user_id, body.notification_id)
        except Exception:
            pass

    return {
        "status": "ok",
        "accepted": state.accepted,
        "dismissed": state.dismissed,
    }
