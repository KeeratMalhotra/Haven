"""Time and date grounding helpers (hardcoded to Asia/Kolkata / IST).

These helpers give the AI agents a concrete sense of "now" so that relative
phrases like "tomorrow", "tonight", or "next monday" resolve to real, absolute
datetimes instead of being hallucinated. Everything is anchored to the
Asia/Kolkata timezone (IST, UTC+5:30) for now.

Public API:
    now_ist() -> datetime
        The current timezone-aware datetime in Asia/Kolkata.
    time_context_string() -> str
        A short human-readable sentence describing "now", injected into agent
        prompts so the model can ground relative date/time references.
    resolve_relative(time_phrase, base=None) -> str | None
        Best-effort conversion of a natural-language time phrase into an ISO
        8601 string with the +05:30 offset. Returns None when the phrase has no
        concrete TIME component (so callers know they must ask the user).
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Hardcoded timezone for the whole app (for now).
IST = ZoneInfo("Asia/Kolkata")

# Weekday name -> Python weekday() index (Monday == 0).
_WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
    # common short forms
    "mon": 0,
    "tue": 1,
    "tues": 1,
    "wed": 2,
    "thu": 3,
    "thur": 3,
    "thurs": 3,
    "fri": 4,
    "sat": 5,
    "sun": 6,
}


def now_ist() -> datetime:
    """Return the current timezone-aware datetime in Asia/Kolkata (IST)."""
    return datetime.now(IST)


def time_context_string() -> str:
    """Return a human-readable description of the current IST date and time.

    Example:
        "Current date and time: Saturday, 28 June 2025, 4:30 PM IST
         (Asia/Kolkata, UTC+5:30). Today is 2025-06-28."
    """
    n = now_ist()
    # %-I and %-d are POSIX (Linux) directives for non-zero-padded values.
    pretty = n.strftime("%A, %-d %B %Y, %-I:%M %p")
    iso_date = n.strftime("%Y-%m-%d")
    return (
        f"Current date and time: {pretty} IST (Asia/Kolkata, UTC+5:30). "
        f"Today is {iso_date}."
    )


def _resolve_date_offset(phrase: str, base: datetime) -> int | None:
    """Determine how many days ahead of ``base`` the phrase refers to.

    Returns the day offset (0 == today). When no explicit date keyword is
    present, returns 0 (caller assumes "today"). Returns None only if there is
    an explicit but unparseable date marker (currently never used).
    """
    # day-after-tomorrow before "tomorrow" so the more specific phrase wins.
    if "day after tomorrow" in phrase or "overmorrow" in phrase:
        return 2
    if "tomorrow" in phrase or "tmrw" in phrase or "tmr" in phrase:
        return 1
    if "today" in phrase or "tonight" in phrase or "tonite" in phrase:
        return 0

    # Weekday references, optionally prefixed with "next".
    # e.g. "next monday", "monday", "on tuesday"
    wd_match = re.search(r"\b(next\s+)?(" + "|".join(_WEEKDAYS.keys()) + r")\b", phrase)
    if wd_match:
        is_next = bool(wd_match.group(1))
        target = _WEEKDAYS[wd_match.group(2)]
        delta = (target - base.weekday()) % 7
        # A bare weekday matching today resolves to today (delta 0). For an
        # explicit "next <weekday>" landing on today, jump a full week ahead.
        if is_next and delta == 0:
            delta = 7
        return delta

    return 0


def _resolve_time_component(phrase: str) -> tuple[int, int] | None:
    """Extract an (hour, minute) 24h tuple from the phrase, or None.

    Only returns a value when a concrete TIME is present. This is the signal
    callers use to decide whether they have enough info to act or must ask.
    """
    # Named times.
    if "noon" in phrase or "midday" in phrase:
        return (12, 0)
    if "midnight" in phrase:
        return (0, 0)

    # 12-hour clock with am/pm, e.g. "6pm", "6:30 pm", "10 am".
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b", phrase)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
        meridiem = m.group(3)
        if hour == 12:
            hour = 0
        if meridiem == "p":
            hour += 12
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return (hour, minute)

    # 24-hour clock with explicit minutes, e.g. "18:00", "09:30".
    m = re.search(r"\b(\d{1,2}):(\d{2})\b", phrase)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2))
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return (hour, minute)

    return None


def resolve_relative(time_phrase: str, base: datetime | None = None) -> str | None:
    """Convert a natural-language time phrase to an ISO 8601 string in IST.

    Handles phrases such as:
        "today 18:00", "tomorrow 15:00", "tomorrow 6pm", "next monday 10:00",
        "6pm", "noon", "2025-06-28T09:00:00".

    Rules:
        - A concrete TIME component must be present. If none is found (e.g.
          "tomorrow" alone, or "monday"), returns None so the caller knows it
          must ask the user for the time.
        - When a time is present but no day, the date defaults to "today".
        - Returned datetimes are timezone-aware in Asia/Kolkata, so the ISO
          string carries the +05:30 offset.

    Args:
        time_phrase: The phrase to interpret.
        base: Reference "now" (defaults to now_ist()).

    Returns:
        ISO 8601 datetime string with +05:30 offset, or None.
    """
    if not time_phrase:
        return None

    base = base or now_ist()
    if base.tzinfo is None:
        base = base.replace(tzinfo=IST)

    raw = time_phrase.strip()
    phrase = raw.lower()

    # Full ISO datetime passthrough (with a time component).
    iso_match = re.match(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}", raw)
    if iso_match:
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=IST)
            return dt.isoformat()
        except ValueError:
            pass

    time_part = _resolve_time_component(phrase)
    if time_part is None:
        # No concrete time -> caller must ask the user.
        return None

    day_offset = _resolve_date_offset(phrase, base)
    if day_offset is None:
        day_offset = 0

    hour, minute = time_part
    target = (base + timedelta(days=day_offset)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    return target.isoformat()
