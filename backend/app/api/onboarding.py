"""Onboarding API router - save user profile and check onboarding status."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query, Request, status
from pydantic import BaseModel, Field

from app.agents.braindump import parse_braindump
from app.auth import verify_google_token
from app.db.models import User, UserProfile
from app.db.repositories import UserRepository

router = APIRouter(prefix="/api", tags=["onboarding"])


class OnboardingRequest(BaseModel):
    """Request body for saving onboarding profile."""

    role: str = ""
    occupation: str = ""
    work_hours_start: int = 9
    work_hours_end: int = 18
    wake_time: int = 7
    sleep_time: int = 23
    priorities: list[str] = Field(default_factory=list)
    daily_routine: str = ""
    goals: list[str] = Field(default_factory=list)


class BrainDumpRequest(BaseModel):
    """Request body for parsing a brain-dump into a populated week."""

    auth_token: str = ""
    braindump: str = ""


async def _get_user_from_token(
    auth_token: Optional[str] = None,
    authorization: Optional[str] = None,
) -> dict:
    """Extract and verify user from token (query param or Authorization header)."""
    token = auth_token
    if not token and authorization:
        # Support "Bearer <token>" header format
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            token = authorization
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return await verify_google_token(token)


@router.post("/onboarding")
async def save_onboarding_profile(
    body: OnboardingRequest,
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Save user onboarding profile to Firestore.

    Accepts auth token as query param or Authorization header.
    Creates user if not found. Marks onboarding as complete.
    """
    user_info = await _get_user_from_token(auth_token, authorization)
    user_id = user_info["sub"]

    # Fetch or create user
    user = await UserRepository.get_by_id(user_id)
    if not user:
        user = User(id=user_id, email=user_info.get("email", ""), name=user_info.get("name", ""))
        await UserRepository.create(user)

    # Build profile data
    profile_data = body.model_dump()
    profile_data["onboarding_complete"] = True

    # Update user profile in Firestore
    await UserRepository.update(user_id, {"profile": profile_data})

    return {"status": "ok", "message": "Onboarding profile saved"}


@router.get("/onboarding/status")
async def get_onboarding_status(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Check if user has completed onboarding."""
    user_info = await _get_user_from_token(auth_token, authorization)
    user_id = user_info["sub"]

    user = await UserRepository.get_by_id(user_id)
    if not user:
        return {"complete": False}

    return {"complete": user.profile.onboarding_complete}


@router.get("/profile")
async def get_profile(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return full user profile."""
    user_info = await _get_user_from_token(auth_token, authorization)
    user_id = user_info["sub"]

    user = await UserRepository.get_by_id(user_id)
    if not user:
        return {"profile": UserProfile().model_dump()}

    return {"profile": user.profile.model_dump()}


@router.post("/onboarding/parse-braindump")
async def parse_braindump_endpoint(
    body: BrainDumpRequest,
    request: Request,
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Parse a free-text brain-dump and instantly populate the user's week.

    Uses Gemini to turn a messy paragraph (e.g. "dentist Tuesday, finish report
    by Friday, gym 3x") into structured tasks, calendar events, and habits, then
    creates them via the Google Tasks/Calendar MCP servers and persists them to
    Firestore. Returns a summary with counts and the created items so the
    frontend can play the "here's your week" reveal.

    Accepts the auth token in the body, as a query param, or via the
    Authorization header.
    """
    token = body.auth_token or auth_token
    user_info = await _get_user_from_token(token, authorization)
    user_id = user_info["sub"]
    resolved_token = body.auth_token or auth_token
    if not resolved_token and authorization:
        resolved_token = (
            authorization[7:] if authorization.startswith("Bearer ") else authorization
        )

    # Ensure the user exists so persisted tasks/habits have an owner.
    user = await UserRepository.get_by_id(user_id)
    if not user:
        user = User(
            id=user_id,
            email=user_info.get("email", ""),
            name=user_info.get("name", ""),
        )
        await UserRepository.create(user)

    if not body.braindump.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brain-dump text is required",
        )

    mcp_client = getattr(request.app.state, "mcp_client", None)

    result = await parse_braindump(
        user_id=user_id,
        auth_token=resolved_token or "",
        braindump_text=body.braindump,
        mcp_client=mcp_client,
    )
    return result
