"""Notification inbox API router.

Backs the notification bell + inbox panel in the UI. Every proactive nudge,
suggestion, reminder, autopilot summary and milestone is persisted per user, so
nothing the chief-of-staff says is ever lost. Endpoints:

  GET    /api/notifications            - list recent notifications (+ unread count)
  POST   /api/notifications/{id}/read  - mark a single notification read
  POST   /api/notifications/read-all   - mark every notification read
  DELETE /api/notifications/{id}       - delete a single notification
  DELETE /api/notifications            - clear all notifications

All endpoints are scoped to the authenticated user; a notification belonging to
someone else can never be read, deleted or revealed.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel

from app.auth import verify_google_token
from app.db.repositories import NotificationRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


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


class AuthBody(BaseModel):
    """Minimal request body carrying just the auth token."""

    auth_token: str


@router.get("")
async def list_notifications(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    """List the user's recent notifications, newest first, with unread count."""
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    notifications = await NotificationRepository.list_by_user(user_id, limit=limit)
    unread = sum(1 for n in notifications if not n.read)
    return {
        "notifications": [n.model_dump(mode="json") for n in notifications],
        "unread_count": unread,
    }


@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: str, body: AuthBody):
    """Mark a single notification as read."""
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    user_info = await verify_google_token(body.auth_token)
    user_id = user_info["sub"]

    ok = await NotificationRepository.mark_read(user_id, notification_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"status": "read"}


@router.post("/read-all")
async def mark_all_notifications_read(body: AuthBody):
    """Mark every notification for the user as read."""
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    user_info = await verify_google_token(body.auth_token)
    user_id = user_info["sub"]

    updated = await NotificationRepository.mark_all_read(user_id)
    return {"status": "ok", "updated": updated}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Delete a single notification."""
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    ok = await NotificationRepository.delete(user_id, notification_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"status": "deleted"}


@router.delete("")
async def clear_all_notifications(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Delete all notifications for the user ('clear all')."""
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    deleted = await NotificationRepository.clear_all(user_id)
    return {"status": "cleared", "deleted": deleted}
