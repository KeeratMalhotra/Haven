"""Memory API router — record behavioural signals and surface learned memory.

Sprint 11 "The Brain Gets Real". Endpoints:
  POST   /api/memory/observe   - record a behavioural signal (task_completed, ...)
  GET    /api/memory/insights  - learned, human-readable insights
  GET    /api/memory           - full memory view for the transparency page
  POST   /api/memory/distill   - force a fresh distillation pass (refresh)
  POST   /api/memory/forget    - forget a single insight / preference / alias
  DELETE /api/memory           - clear ALL learned memory for the user

All write paths degrade gracefully: learning is best-effort and never blocks
the user. User-derived text is treated as opaque data by the distiller.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel

from app.agents.memory import (
    VALID_OBSERVATION_TYPES,
    distill_insights,
    record_observation,
)
from app.auth import verify_google_token
from app.db.repositories import MemoryRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memory", tags=["memory"])


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


class ObserveRequest(BaseModel):
    """Request body for recording a behavioural observation."""

    auth_token: str
    type: str
    data: dict = {}
    timestamp: Optional[str] = None


class ForgetRequest(BaseModel):
    """Request body for forgetting a single piece of learned memory."""

    auth_token: str
    # "insight" | "preference" | "vocabulary" | "pattern"
    kind: str
    # For insights: the insight id. For preference/vocabulary: the map key.
    id: Optional[str] = None
    key: Optional[str] = None
    # For patterns (no id): the exact pattern string to remove.
    value: Optional[str] = None


class DistillRequest(BaseModel):
    """Request body for forcing a distillation refresh."""

    auth_token: str


def _memory_view(memory) -> dict:
    """Shape a UserMemory into the transparency-page payload."""
    return {
        "productive_hours": memory.productive_hours,
        "avoided_hours": memory.avoided_hours,
        "task_patterns": memory.task_patterns,
        "learned_preferences": memory.learned_preferences,
        "vocabulary": memory.vocabulary,
        "behavioral_stats": memory.behavioral_stats.model_dump(),
        "insights": [i.model_dump(mode="json") for i in memory.insights],
        "observation_count": len(memory.observations or []),
        "updated_at": memory.updated_at.isoformat() if memory.updated_at else None,
        "last_distilled_at": (
            memory.last_distilled_at.isoformat()
            if memory.last_distilled_at
            else None
        ),
    }


@router.post("/observe")
async def observe(body: ObserveRequest):
    """Record a behavioural signal so ChronAI can learn from it.

    Accepts events like ``task_completed``, ``task_rescheduled``,
    ``focus_session`` and ``task_created`` with an optional timestamp and
    payload (hour, title, estimated/actual minutes, from_hour/to_hour).
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user = await verify_google_token(body.auth_token)
    user_id = user.get("sub", "")

    if body.type not in VALID_OBSERVATION_TYPES:
        # Accept it but tell the caller it won't drive statistics.
        logger.info(f"[memory] Unrecognized observation type: {body.type!r}")

    memory = await record_observation(
        user_id, body.type, body.data or {}, body.timestamp
    )
    if memory is None:
        return {"status": "skipped"}

    return {
        "status": "recorded",
        "behavioral_stats": memory.behavioral_stats.model_dump(),
        "observation_count": len(memory.observations or []),
    }


@router.get("/insights")
async def get_insights(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return the user's learned insights as readable strings.

    Distillation is refreshed opportunistically (debounced) so insights stay
    fresh without the client having to ask.
    """
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    # Opportunistic, debounced refresh — distill_insights decides if it's due.
    memory = await distill_insights(user_id, force=False)

    return {
        "insights": [i.text for i in memory.insights],
        "detailed": [i.model_dump(mode="json") for i in memory.insights],
    }


@router.get("")
async def get_memory_view(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return the full learned-memory view for the transparency page."""
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    memory = await MemoryRepository.get_memory(user_id)
    return _memory_view(memory)


@router.post("/distill")
async def force_distill(body: DistillRequest):
    """Force a fresh distillation pass and return the updated memory view."""
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    user_info = await verify_google_token(body.auth_token)
    user_id = user_info["sub"]

    memory = await distill_insights(user_id, force=True)
    return _memory_view(memory)


@router.post("/forget")
async def forget(body: ForgetRequest):
    """Forget a single piece of learned memory (user control / trust).

    Supported kinds:
      - "insight":    remove the insight whose id == ``id``.
      - "preference": remove the learned_preferences entry keyed by ``key``.
      - "vocabulary": remove the vocabulary alias keyed by ``key``.
      - "pattern":    remove the task_patterns entry equal to ``value``.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    user_info = await verify_google_token(body.auth_token)
    user_id = user_info["sub"]

    memory = await MemoryRepository.get_memory(user_id)
    removed = False

    if body.kind == "insight" and body.id:
        before = len(memory.insights)
        memory.insights = [i for i in memory.insights if i.id != body.id]
        removed = len(memory.insights) != before
    elif body.kind == "preference" and body.key:
        if body.key in memory.learned_preferences:
            memory.learned_preferences.pop(body.key, None)
            removed = True
    elif body.kind == "vocabulary" and body.key:
        if body.key in memory.vocabulary:
            memory.vocabulary.pop(body.key, None)
            removed = True
    elif body.kind == "pattern" and body.value:
        before = len(memory.task_patterns)
        memory.task_patterns = [p for p in memory.task_patterns if p != body.value]
        removed = len(memory.task_patterns) != before
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a valid 'kind' and the matching id/key/value.",
        )

    if removed:
        await MemoryRepository.save_memory(memory)

    return {"status": "forgotten" if removed else "not_found", "view": _memory_view(memory)}


@router.delete("")
async def clear_all(
    auth_token: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Clear ALL learned memory for the user ('forget everything')."""
    token = _extract_token(auth_token, authorization)
    user_info = await verify_google_token(token)
    user_id = user_info["sub"]

    await MemoryRepository.clear_memory(user_id)
    return {"status": "cleared"}
