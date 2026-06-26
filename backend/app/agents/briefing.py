"""Daily briefing generator - personalized morning briefing using Gemini."""

import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import vertexai
import vertexai.generative_models

from app.config import settings
from app.db.repositories import UserRepository
from app.utils.timectx import now_ist

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")


async def generate_daily_briefing(
    user_id: str, auth_token: str, mcp_client: Any
) -> str:
    """Generate a personalized daily briefing for the user.

    Fetches today's calendar events and pending tasks via MCP, combines
    with user profile data, and uses Gemini to compose a warm, concise,
    actionable morning briefing.

    Args:
        user_id: The user's Firestore document ID.
        auth_token: Google OAuth token for MCP tool calls.
        mcp_client: MCP client instance for tool access.

    Returns:
        The generated briefing text, or a fallback message on error.
    """
    # Fetch user profile
    user = await UserRepository.get_by_id(user_id)
    profile_info = ""
    user_name = ""
    if user:
        user_name = user.name or ""
        if user.profile.onboarding_complete:
            p = user.profile
            profile_info = (
                f"Role: {p.role}, Occupation: {p.occupation}. "
                f"Work hours: {p.work_hours_start}:00 - {p.work_hours_end}:00. "
                f"Priorities: {', '.join(p.priorities) if p.priorities else 'none set'}. "
                f"Goals: {', '.join(p.goals) if p.goals else 'none set'}."
            )

    # Fetch today's calendar events
    events_text = "No calendar events available."
    if mcp_client and auth_token:
        try:
            events = await mcp_client.call_tool(
                "google-calendar",
                "list_events",
                {"auth_token": auth_token, "days_ahead": 1},
            )
            if events:
                events_text = f"Today's events: {events}"
        except Exception as e:
            logger.warning(f"[briefing] Failed to fetch calendar events: {e}")

    # Fetch pending tasks
    tasks_text = "No pending tasks available."
    if mcp_client and auth_token:
        try:
            tasks = await mcp_client.call_tool(
                "google-tasks",
                "list_tasks",
                {"auth_token": auth_token},
            )
            if tasks:
                tasks_text = f"Pending tasks: {tasks}"
        except Exception as e:
            logger.warning(f"[briefing] Failed to fetch tasks: {e}")

    # Build prompt for Gemini
    current_time = now_ist()
    time_of_day = "morning"
    hour = current_time.hour
    if hour >= 12 and hour < 17:
        time_of_day = "afternoon"
    elif hour >= 17:
        time_of_day = "evening"

    prompt = f"""You are ChronAI, a warm and helpful AI productivity companion.
Generate a personalized {time_of_day} briefing for the user.

User name: {user_name or 'there'}
{f'User profile: {profile_info}' if profile_info else 'User has not set up their profile yet.'}

{events_text}
{tasks_text}

Current time: {current_time.strftime('%A, %d %B %Y, %I:%M %p')} IST

Guidelines:
- Start with a warm, time-appropriate greeting using the user's name
- Summarize today's schedule concisely
- Highlight upcoming deadlines or important tasks
- Offer 1-2 actionable suggestions based on their priorities
- Keep it concise (3-5 short paragraphs max)
- Be encouraging and positive
- Do NOT use markdown headers or bullet points - write in natural flowing prose"""

    # Use Gemini to generate the briefing
    try:
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        model = vertexai.generative_models.GenerativeModel(settings.GEMINI_MODEL)
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error(f"[briefing] Gemini generation failed: {e}", exc_info=True)
        greeting = f"Good {time_of_day}"
        if user_name:
            greeting += f", {user_name}"
        return f"{greeting}! I was not able to generate your full briefing right now, but I am here to help you stay productive today."
