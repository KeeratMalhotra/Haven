"""Briefing API router - generate daily briefing."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query, Request, status

from app.auth import verify_google_token
from app.agents.briefing import generate_daily_briefing, generate_today_briefing
from app.db.repositories import UserRepository
from app.utils.timectx import now_ist

router = APIRouter(prefix="/api", tags=["briefing"])


def _extract_token(
    auth_token: Optional[str], authorization: Optional[str]
) -> str:
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


@router.get("/briefing")
async def get_daily_briefing(
    request: Request,
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Generate and return a personalized daily briefing.

    Requires auth token as query param or Authorization header.
    """
    token = auth_token
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            token = authorization
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    # Access mcp_client from app state (set during lifespan startup)
    mcp_client = getattr(request.app.state, "mcp_client", None)

    briefing = await generate_daily_briefing(user_id, token, mcp_client)
    return {"briefing": briefing}


@router.get("/briefing/today")
async def get_today_briefing(
    request: Request,
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return a structured, AI-narrated briefing for the user's day.

    Includes today's meetings, near-term deadlines, the top priority, any
    tight-gap/conflict warnings, summary stats, and a short natural-language
    narration. Powers the dashboard "Good morning, here's your day" focal card.
    """
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    mcp_client = getattr(request.app.state, "mcp_client", None)
    return await generate_today_briefing(user_id, token, mcp_client)


@router.post("/streak/checkin")
async def streak_checkin(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Record a daily engagement and return the updated streak.

    Increments the user's consecutive-day streak on the first visit each day,
    resets it when a day is missed, and is idempotent within the same day.
    """
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    today = now_ist().strftime("%Y-%m-%d")
    result = await UserRepository.record_engagement(user_id, today)
    return result


@router.get("/streak")
async def get_streak(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return the user's current streak without recording engagement."""
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    user = await UserRepository.get_by_id(user_id)
    if not user:
        return {"streak": 0, "longest_streak": 0, "last_active_date": ""}
    return {
        "streak": user.streak,
        "longest_streak": user.longest_streak,
        "last_active_date": user.last_active_date,
    }
