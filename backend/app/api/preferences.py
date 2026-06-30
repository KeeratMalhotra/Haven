"""User Preferences API router.

Provides:
  POST /api/preferences/get - Retrieve user preferences and notification_preferences
  PUT  /api/preferences - Partially update user preferences and/or notification_preferences
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth import verify_google_token
from app.db.repositories import UserRepository
from app.utils.email_notifications import send_notifications_enabled_confirmation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


def _send_notifications_confirmation(user_id: str, user_email: str) -> None:
    """Fire-and-forget task to send a notifications-enabled confirmation email.

    Retrieves the user's Google tokens from Firestore and sends the email
    in a background asyncio task so the API response is not delayed.
    """

    async def _do_send():
        try:
            user = await UserRepository.get_by_id(user_id)
            if not user or not user_email:
                return
            # Gmail token is stored in connected_services.gmail (incremental OAuth)
            gmail_tokens = user.connected_services.get("gmail", {})
            # Fallback to legacy google_tokens if connected_services.gmail not present
            tokens = gmail_tokens if gmail_tokens.get("access_token") else user.google_tokens
            if tokens:
                await send_notifications_enabled_confirmation(
                    user_email, tokens
                )
        except Exception as e:
            logger.warning(
                "Failed to send notifications confirmation to %s: %s",
                user_email,
                e,
            )

    try:
        loop = asyncio.get_event_loop()
        loop.create_task(_do_send())
    except RuntimeError:
        pass


class GetPreferencesRequest(BaseModel):
    """Request body for fetching preferences."""

    auth_token: str


class UpdatePreferencesRequest(BaseModel):
    """Request body for updating preferences."""

    auth_token: str
    preferences: Optional[dict] = None
    notification_preferences: Optional[dict] = None


@router.post("/get")
async def get_preferences(body: GetPreferencesRequest):
    """Get user's preferences and notification_preferences from Firestore.

    Uses POST to avoid leaking the auth token in query parameters/URL.

    Args:
        body: Request body containing auth_token.

    Returns:
        Dict with 'preferences' and 'notification_preferences' keys.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user_info = await verify_google_token(body.auth_token)
    user_id = user_info.get("sub", "")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not determine user identity",
        )

    user = await UserRepository.get_by_id(user_id)

    if not user:
        # Return defaults if user doc doesn't exist yet
        return {
            "preferences": {},
            "notification_preferences": {
                "email_notifications": True,
                "email_for_urgent_only": False,
                "email_deadline_reminders": True,
                "daily_digest": False,
                "weekly_review": False,
            },
        }

    return {
        "preferences": user.preferences,
        "notification_preferences": user.notification_preferences,
    }


@router.put("")
async def update_preferences(body: UpdatePreferencesRequest):
    """Partially update user preferences and/or notification_preferences.

    Only provided keys are merged into the existing document. This allows
    the frontend to send incremental updates without overwriting unrelated fields.

    Args:
        body: JSON body with auth_token and optional preferences/notification_preferences dicts.

    Returns:
        Updated preferences and notification_preferences.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user_info = await verify_google_token(body.auth_token)
    user_id = user_info.get("sub", "")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not determine user identity",
        )

    # Build the update payload - merge partial updates
    update_data: dict = {}

    if body.preferences is not None:
        # Merge with existing preferences
        existing_user = await UserRepository.get_by_id(user_id)
        if existing_user:
            merged_prefs = {**existing_user.preferences, **body.preferences}
        else:
            merged_prefs = body.preferences
        update_data["preferences"] = merged_prefs

    if body.notification_preferences is not None:
        # Merge with existing notification_preferences
        existing_user = await UserRepository.get_by_id(user_id)
        old_deadline_reminders = False
        if existing_user:
            old_deadline_reminders = existing_user.notification_preferences.get(
                "email_deadline_reminders", False
            )
            merged_notif = {
                **existing_user.notification_preferences,
                **body.notification_preferences,
            }
        else:
            merged_notif = body.notification_preferences
        update_data["notification_preferences"] = merged_notif

        # Check if email_deadline_reminders was just toggled ON
        new_deadline_reminders = merged_notif.get("email_deadline_reminders", False)
        if new_deadline_reminders and not old_deadline_reminders:
            # Send confirmation email in background (non-blocking)
            _send_notifications_confirmation(user_id, user_info.get("email", ""))

    if update_data:
        try:
            await UserRepository.update(user_id, update_data)
        except Exception as e:
            # If the user document doesn't exist yet, create it
            logger.info(f"User doc not found, creating for {user_id}: {e}")
            from app.db.models import User

            new_user = User(
                id=user_id,
                email=user_info.get("email", ""),
                name=user_info.get("name", ""),
                preferences=update_data.get("preferences", {}),
                notification_preferences=update_data.get(
                    "notification_preferences",
                    {
                        "email_notifications": True,
                        "email_for_urgent_only": False,
                        "email_deadline_reminders": True,
                        "daily_digest": False,
                        "weekly_review": False,
                    },
                ),
            )
            await UserRepository.create(new_user)

    # Return the updated state
    user = await UserRepository.get_by_id(user_id)
    if user:
        return {
            "preferences": user.preferences,
            "notification_preferences": user.notification_preferences,
        }

    return {
        "preferences": update_data.get("preferences", {}),
        "notification_preferences": update_data.get("notification_preferences", {}),
    }
