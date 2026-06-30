"""Google Slides API router - AI presentation generation via MCP.

Provides:
  POST /api/slides/generate-outline - Generate a presentation outline from task context
  POST /api/slides/create - Create a Google Slides presentation from an outline
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.auth import verify_google_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/slides", tags=["slides"])


class GenerateOutlineRequest(BaseModel):
    """Request body for generating a presentation outline."""
    auth_token: str
    task_title: str
    task_notes: str = ""
    task_subtasks: list[str] = []


class SlideData(BaseModel):
    """A single slide in the outline."""
    title: str
    bullets: list[str] = []


class OutlineData(BaseModel):
    """Presentation outline structure."""
    title: str
    slides: list[SlideData] = []


class CreatePresentationRequest(BaseModel):
    """Request body for creating a Google Slides presentation."""
    auth_token: str
    outline: OutlineData


def _get_mcp_client(request: Request) -> Any:
    """Retrieve the MCP client from app state.

    Args:
        request: The incoming FastAPI request.

    Returns:
        The MCPClient instance or None.
    """
    return getattr(request.app.state, "mcp_client", None)


@router.post("/generate-outline")
async def generate_outline(body: GenerateOutlineRequest, request: Request):
    """Generate a presentation outline from task context using AI.

    Takes task title, notes, and subtasks, then uses the MCP slides server
    with Gemini to generate a structured presentation outline.

    Args:
        body: Request with auth_token, task_title, task_notes, task_subtasks.
        request: FastAPI request for accessing app state.

    Returns:
        A presentation outline with title and slides array.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await verify_google_token(body.auth_token)

    task_title = body.task_title.strip()
    if not task_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task title is required",
        )

    mcp_client = _get_mcp_client(request)
    if not mcp_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MCP client not available",
        )

    try:
        result = await mcp_client.call_tool(
            "google-slides",
            "generate_outline",
            {
                "auth_token": body.auth_token,
                "task_title": task_title,
                "task_notes": body.task_notes,
                "task_subtasks": body.task_subtasks,
            },
        )

        if isinstance(result, dict) and result.get("error"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["error"],
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Outline generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate outline. Please try again.",
        )


@router.post("/create")
async def create_presentation(body: CreatePresentationRequest, request: Request):
    """Create a Google Slides presentation from an outline.

    Uses the MCP slides server to create a new presentation and populate
    it with slides from the provided outline.

    Args:
        body: Request with auth_token and outline data.
        request: FastAPI request for accessing app state.

    Returns:
        The presentation URL.
    """
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await verify_google_token(body.auth_token)

    if not body.outline.slides:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Outline must contain at least one slide",
        )

    mcp_client = _get_mcp_client(request)
    if not mcp_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MCP client not available",
        )

    try:
        # Convert outline to dict for MCP call
        outline_dict = {
            "title": body.outline.title,
            "slides": [
                {"title": slide.title, "bullets": slide.bullets}
                for slide in body.outline.slides
            ],
        }

        result = await mcp_client.call_tool(
            "google-slides",
            "create_presentation",
            {
                "auth_token": body.auth_token,
                "outline": outline_dict,
            },
        )

        if isinstance(result, dict) and result.get("error"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["error"],
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Presentation creation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create presentation: {str(e)}",
        )
