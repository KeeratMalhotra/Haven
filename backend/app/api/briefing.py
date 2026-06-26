"""Briefing API router - generate daily briefing."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query, status

from app.auth import verify_google_token
from app.agents.briefing import generate_daily_briefing

router = APIRouter(prefix="/api", tags=["briefing"])


@router.get("/briefing")
async def get_daily_briefing(
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

    # Import mcp_client from main module
    from app.main import mcp_client

    briefing = await generate_daily_briefing(user_id, token, mcp_client)
    return {"briefing": briefing}
