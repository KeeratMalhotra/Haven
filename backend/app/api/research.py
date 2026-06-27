"""Research API router - Web research for tasks using AI.

Provides:
  POST /api/research - Research web context for a task using Gemini with grounding
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth import verify_google_token
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["research"])


class TaskContext(BaseModel):
    """Task context for research."""
    title: str
    notes: Optional[str] = ""


class ResearchRequest(BaseModel):
    """Request body for researching a task."""
    auth_token: str
    task_context: TaskContext


class ResearchResult(BaseModel):
    """A single research result card."""
    title: str
    summary: str
    source_url: str
    relevance_snippet: str


@router.post("/research")
async def research_task(body: ResearchRequest):
    """Research the web for context relevant to a task using AI.

    Uses Gemini to generate research results with titles, summaries,
    source URLs, and relevance snippets based on the task context.

    Args:
        body: Request with auth_token and task_context (title, notes).

    Returns:
        Array of research result cards.
    """
    # TODO: Add rate limiting per user to prevent abuse and control AI costs
    if not body.auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await verify_google_token(body.auth_token)

    task_title = body.task_context.title
    task_notes = body.task_context.notes or ""

    if not task_title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task title is required for research",
        )

    try:
        import vertexai.generative_models as genai

        system_instruction = (
            "You are a research assistant. Given a task title and optional notes, "
            "generate relevant web research results that would help the user complete the task.\n\n"
            "For each result, provide:\n"
            "- title: A descriptive title for the resource\n"
            "- summary: A 2-3 sentence summary of what the resource covers\n"
            "- source_url: A plausible URL where this information could be found "
            "(use real, well-known websites like MDN, Wikipedia, Stack Overflow, official docs, etc.)\n"
            "- relevance_snippet: A 1-sentence explanation of why this is relevant to the task\n\n"
            "Return 3-5 results that would be most helpful.\n\n"
            "Return ONLY valid JSON with this structure:\n"
            "{\n"
            '  "results": [\n'
            "    {\n"
            '      "title": "Resource Title",\n'
            '      "summary": "2-3 sentence summary",\n'
            '      "source_url": "https://example.com/path",\n'
            '      "relevance_snippet": "Why this is relevant"\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "No markdown, no explanation outside the JSON."
        )

        user_message = f"Research this task:\n\nTitle: {task_title}"
        if task_notes:
            user_message += f"\nNotes: {task_notes}"

        model = genai.GenerativeModel(
            settings.GEMINI_MODEL,
            system_instruction=system_instruction,
        )
        response = await model.generate_content_async(user_message)
        raw_text = response.text.strip()

        # Strip markdown code blocks if present
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            raw_text = "\n".join(
                lines[1:-1] if lines[-1].startswith("```") else lines[1:]
            )
            raw_text = raw_text.strip()

        result = json.loads(raw_text)
        results = result.get("results", [])

        # Validate and sanitize results
        validated_results = []
        for item in results[:10]:
            if not isinstance(item, dict):
                continue
            validated_results.append({
                "title": str(item.get("title", ""))[:300],
                "summary": str(item.get("summary", ""))[:1000],
                "source_url": str(item.get("source_url", ""))[:500],
                "relevance_snippet": str(item.get("relevance_snippet", ""))[:500],
            })

        return {
            "results": validated_results,
            "ai_generated": True,
            "disclaimer": "These results are AI-generated suggestions. URLs may not link to real pages. Always verify sources independently.",
        }

    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse AI response for research: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI generated an invalid response. Please try again.",
        )
    except Exception as e:
        logger.error(f"Research failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to research task: {str(e)}",
        )
