"""User context utilities for injecting profile info into agent prompts."""

from app.db.repositories import UserRepository


async def get_user_context(user_id: str) -> str:
    """Fetch user profile and return a formatted context string for prompts.

    Includes the user's onboarding profile AND any behavioural memory ChronAI
    has learned over time (productive hours, patterns, learned preferences,
    insights). The memory section is appended so ALL agents — orchestrator,
    planner, scheduler — adapt to how the user actually works.

    Args:
        user_id: The user's Firestore document ID.

    Returns:
        Formatted string describing the user's profile, learned memory and
        preferences, or a notice that onboarding has not been completed.
    """
    if not user_id:
        return "User has not completed onboarding."

    user = await UserRepository.get_by_id(user_id)
    if not user or not user.profile.onboarding_complete:
        # Even without onboarding, surface learned memory if we have any.
        memory_block = await _safe_memory_context(user_id)
        if memory_block:
            return f"User has not completed onboarding.\n\n{memory_block}"
        return "User has not completed onboarding."

    profile = user.profile
    lines = [
        "User Profile:",
        f"  Role: {profile.role}",
        f"  Occupation: {profile.occupation}",
        f"  Work hours: {profile.work_hours_start}:00 - {profile.work_hours_end}:00",
        f"  Wake time: {profile.wake_time}:00, Sleep time: {profile.sleep_time}:00",
    ]
    if profile.priorities:
        lines.append(f"  Priorities: {', '.join(profile.priorities)}")
    if profile.goals:
        lines.append(f"  Goals: {', '.join(profile.goals)}")
    if profile.daily_routine:
        lines.append(f"  Daily routine: {profile.daily_routine}")

    context = "\n".join(lines)

    memory_block = await _safe_memory_context(user_id)
    if memory_block:
        context = f"{context}\n\n{memory_block}"

    return context


async def _safe_memory_context(user_id: str) -> str:
    """Fetch the learned-memory context, degrading gracefully on any error."""
    try:
        # Imported lazily to avoid a circular import at module load time
        # (memory -> repositories -> ... ) and to keep this util light.
        from app.agents.memory import get_memory_context

        return await get_memory_context(user_id)
    except Exception:
        return ""
