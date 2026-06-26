"""User context utilities for injecting profile info into agent prompts."""

from app.db.repositories import UserRepository


async def get_user_context(user_id: str) -> str:
    """Fetch user profile and return a formatted context string for prompts.

    Args:
        user_id: The user's Firestore document ID.

    Returns:
        Formatted string describing the user's profile and preferences,
        or a notice that onboarding has not been completed.
    """
    if not user_id:
        return "User has not completed onboarding."

    user = await UserRepository.get_by_id(user_id)
    if not user or not user.profile.onboarding_complete:
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

    return "\n".join(lines)
