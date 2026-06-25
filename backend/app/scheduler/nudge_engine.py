"""Nudge Engine - Escalation logic and Gemini-powered nudge generation.

Classifies task urgency based on deadline proximity and generates
context-aware nudge messages using the Gemini AI model.
"""

from datetime import datetime, timedelta, timezone

from google import genai

from app.config import settings


NUDGE_SYSTEM_PROMPT = """You are a proactive productivity assistant generating nudge messages.
Your job is to write a short, helpful reminder message for a user about an upcoming deadline.

Rules:
- Keep messages concise (1-2 sentences max)
- Match the tone to the urgency level:
  - gentle: friendly, encouraging, non-pressuring
  - urgent: direct, action-oriented, with a specific suggestion
  - critical: empathetic but firm, offer to help reschedule or provide completion assistance
- Include the task title naturally in the message
- Mention the time remaining
- Do not use exclamation marks for critical messages (keep calm)
- Be helpful, not annoying

Respond with ONLY the nudge message text, no JSON or formatting."""


def classify_urgency(deadline: datetime) -> str:
    """Classify urgency level based on time remaining until deadline.

    Args:
        deadline: The task's deadline datetime (should be timezone-aware or naive UTC).

    Returns:
        Urgency level string: 'gentle', 'urgent', or 'critical'.
    """
    now = datetime.now(timezone.utc)

    # Ensure deadline is timezone-aware for comparison
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    remaining = deadline - now

    if remaining <= timedelta(hours=1):
        return "critical"
    elif remaining <= timedelta(hours=6):
        return "urgent"
    elif remaining <= timedelta(hours=24):
        return "gentle"
    else:
        # Not within notification window
        return "gentle"


def _format_time_remaining(deadline: datetime) -> str:
    """Format the time remaining until a deadline as a human-readable string.

    Args:
        deadline: The task's deadline datetime.

    Returns:
        Human-readable time remaining string.
    """
    now = datetime.now(timezone.utc)

    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    remaining = deadline - now

    if remaining.total_seconds() <= 0:
        return "overdue"

    hours = remaining.total_seconds() / 3600
    if hours < 1:
        minutes = int(remaining.total_seconds() / 60)
        return f"{minutes} minutes"
    elif hours < 24:
        return f"{hours:.1f} hours"
    else:
        days = hours / 24
        return f"{days:.1f} days"


async def generate_nudge(task_title: str, urgency: str, time_remaining: str) -> str:
    """Generate a context-aware nudge message using Gemini.

    Args:
        task_title: The title of the task approaching its deadline.
        urgency: Urgency level ('gentle', 'urgent', or 'critical').
        time_remaining: Human-readable string of time remaining.

    Returns:
        Generated nudge message string.
    """
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        prompt = f"""Generate a {urgency} nudge message for the following task:
Task: {task_title}
Urgency: {urgency}
Time remaining: {time_remaining}

Remember:
- gentle: friendly reminder, the user has time
- urgent: action-oriented, suggest what to do next
- critical: offer to reschedule or provide completion help"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "system_instruction": NUDGE_SYSTEM_PROMPT,
            },
        )
        return response.text.strip()
    except Exception:
        # Fallback messages when Gemini is unavailable
        fallback_messages = {
            "gentle": f"Friendly reminder: '{task_title}' is due in {time_remaining}.",
            "urgent": f"Heads up: '{task_title}' is due in {time_remaining}. Consider focusing on this next.",
            "critical": f"'{task_title}' is due in {time_remaining}. Would you like help rescheduling or breaking this into smaller steps?",
        }
        return fallback_messages.get(urgency, fallback_messages["gentle"])
