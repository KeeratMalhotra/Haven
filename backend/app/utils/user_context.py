"""User context utilities for injecting profile info into agent prompts."""

from app.db.repositories import UserRepository


# Mapping of service IDs to human-readable names used in context strings.
_SERVICE_DISPLAY_NAMES: dict[str, str] = {
    "calendar": "Google Calendar",
    "tasks": "Google Tasks",
    "gmail": "Gmail",
    "slides": "Google Slides",
    "spotify": "Spotify",
}


async def get_user_context(user_id: str) -> str:
    """Fetch user profile and return a formatted context string for prompts.

    Includes the user's onboarding profile AND any behavioural memory ChronAI
    has learned over time (productive hours, patterns, learned preferences,
    insights). The memory section is appended so ALL agents -- orchestrator,
    planner, scheduler -- adapt to how the user actually works.

    Also includes which third-party services (Google Calendar, Tasks, Gmail,
    Slides, Spotify) are currently connected or disconnected so AI agents can
    guide the user appropriately (e.g. suggesting they connect a service
    before requesting a feature that depends on it).

    Args:
        user_id: The user's Firestore document ID.

    Returns:
        Formatted string describing the user's profile, learned memory,
        service connection status, and preferences, or a notice that
        onboarding has not been completed.
    """
    if not user_id:
        return "User has not completed onboarding."

    user = await UserRepository.get_by_id(user_id)
    if not user or not user.profile.onboarding_complete:
        # Even without onboarding, surface learned memory if we have any.
        memory_block = await _safe_memory_context(user_id)
        integrations_block = await _safe_integrations_context(user_id)
        parts = ["User has not completed onboarding."]
        if integrations_block:
            parts.append(integrations_block)
        if memory_block:
            parts.append(memory_block)
        return "\n\n".join(parts)

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

    integrations_block = await _safe_integrations_context(user_id)
    if integrations_block:
        context = f"{context}\n\n{integrations_block}"

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


async def _safe_integrations_context(user_id: str) -> str:
    """Build a context block describing which services are connected/disconnected.

    This allows all AI agents to know the user's integration state so they can
    provide helpful guidance (e.g. "Connect Google Slides in Settings to use
    this feature") instead of attempting actions that will fail.

    Degrades gracefully: returns empty string if Firestore is unreachable.
    """
    try:
        from app.db.firestore import get_db

        db = get_db()
        user_ref = db.collection("users").document(user_id)
        doc = await user_ref.get()

        # Calendar, Tasks, and Slides are mandatory (granted at sign-in) so
        # they are always reported as connected regardless of Firestore state.
        MANDATORY_SERVICES = {"calendar", "tasks", "slides"}

        if not doc.exists:
            # No user doc yet -- mandatory services are connected, others are not
            lines = ["Connected Services:"]
            for service_id, display_name in _SERVICE_DISPLAY_NAMES.items():
                if service_id in MANDATORY_SERVICES:
                    lines.append(f"  {display_name} is connected.")
                else:
                    lines.append(f"  {display_name} is NOT connected.")
            return "\n".join(lines)

        data = doc.to_dict() or {}
        connected_services = data.get("connected_services", {})
        spotify_tokens = data.get("spotify_tokens", {})

        lines = ["Connected Services:"]
        for service_id, display_name in _SERVICE_DISPLAY_NAMES.items():
            if service_id in MANDATORY_SERVICES:
                # Core services are always connected (granted at sign-in)
                is_connected = True
            elif service_id == "spotify":
                is_connected = bool(spotify_tokens.get("access_token"))
            else:
                explicitly_disconnected = connected_services.get(service_id, {}).get(
                    "explicitly_disconnected", False
                )
                is_connected = connected_services.get(service_id, {}).get(
                    "connected", False
                ) and not explicitly_disconnected

            status_str = "is connected" if is_connected else "is NOT connected"
            lines.append(f"  {display_name} {status_str}.")

        return "\n".join(lines)
    except Exception:
        return ""
