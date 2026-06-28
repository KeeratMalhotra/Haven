"""Scheduler Agent - Calendar management and time optimization.

Finds optimal time slots for tasks and events using Vertex AI Gemini,
and manages the calendar through the Google Calendar MCP server.

Intelligence features:
- Grounded in real IST (Asia/Kolkata) date/time so relative phrases resolve.
- Slot-filling: NEVER invents a date or time. If a create request is missing a
  concrete time (or date), it asks the user instead of guessing.
- Pending-action memory: completes a half-specified request on the next turn.
- Conflict detection: warns about overlapping events before creating.
- Reschedule / delete intents in addition to create / list / find.
"""

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Optional

logger = logging.getLogger(__name__)

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings
from app.db.firestore import get_db
from app.utils.timectx import IST, now_ist, resolve_relative, time_context_string
from app.utils.user_context import get_user_context


SCHEDULER_PROMPT = """You are a scheduling specialist. You manage the user's calendar.
You MUST NOT invent or guess a date or time that the user did not provide. If a
required detail is missing, you ask for it instead of making something up.

You will be given the CURRENT date and time. Use it to resolve relative phrases
like "today", "tonight", "tomorrow", or "next monday" into concrete values.

ACTION SELECTION RULES:
- The user wants to SEE their schedule / events ("what's on my calendar", "my schedule") -> action: "list_events"
- The user wants to find free time / availability ("when am I free", "find a slot") -> action: "find_slots"
- The user wants to CREATE/book an event, OR states they HAVE an event ("I have a meeting at 6pm", "there's a standup at 10am", "Create event: ...") -> action: "create_event"
- The user wants to MOVE/reschedule an event ("move my 6pm to 8pm", "reschedule the standup to 11") -> action: "reschedule_event"
- The user wants to CANCEL/delete an event ("cancel my dentist appointment", "delete the standup") -> action: "delete_event"
- The user wants a SMART TIME SUGGESTION for a task ("find me time for X", "when should I work on X", "I need 2 hours for deep work") -> action: "suggest_time"
- The user wants to START a FOCUS SESSION ("start a focus session", "focus mode", "deep work for 90 minutes", "pomodoro") -> action: "focus_session"

CLARIFICATION RULES (CRITICAL - this is the most important behavior):
A calendar event REQUIRES both a concrete DATE and a concrete TIME.
- If a TIME is given but NO day -> assume TODAY. (e.g. "I have a meeting at 6pm" -> today 18:00)
- If a DAY is given but NO time -> action: "needs_info". Ask specifically for the time. Do NOT invent a time.
- If NEITHER date nor time is given for a create -> action: "needs_info". Ask for the time/day.
- A missing TITLE is fine: default it to "Meeting" or "Event". Never ask just for a title.

When action is "needs_info", respond with:
{
  "action": "needs_info",
  "question": "A specific question asking ONLY for the missing detail",
  "pending": { "summary": "Meeting", "start_time": "tomorrow", "duration_minutes": 60 },
  "awaiting": "time" | "date",
  "intent": "create"
}
The "pending" object must capture everything you DO know so far.

For all other actions respond with:
{
  "action": "find_slots|create_event|list_events|reschedule_event|delete_event",
  "event_details": {
    "summary": "event title",
    "description": "event description",
    "start_time": "today 18:00 or tomorrow 15:00 or next monday 10:00 or ISO format",
    "new_time": "for reschedule: the NEW start time, e.g. today 20:00",
    "match": "for reschedule/delete: words identifying which event (title and/or time)",
    "duration_minutes": 60,
    "preferred_time": "morning|afternoon|evening|any",
    "date_range_days": 7
  },
  "response": "A natural language response explaining what you're doing"
}

EXAMPLES:
- "What's on my calendar this week?" -> {"action": "list_events", "response": "Let me check your calendar."}
- "Find me a free slot tomorrow" -> {"action": "find_slots", "event_details": {"duration_minutes": 60}}
- "Create event: dentist, tomorrow at 3pm" -> {"action": "create_event", "event_details": {"summary": "Dentist", "start_time": "tomorrow 15:00", "duration_minutes": 60}}
- "I have a meeting at 6pm" -> {"action": "create_event", "event_details": {"summary": "Meeting", "start_time": "today 18:00", "duration_minutes": 60}}
- "I have a meeting tomorrow" -> {"action": "needs_info", "question": "What time is your meeting tomorrow?", "pending": {"summary": "Meeting", "start_time": "tomorrow", "duration_minutes": 60}, "awaiting": "time", "intent": "create"}
- "Schedule a sync" -> {"action": "needs_info", "question": "Sure — what day and time should I schedule the sync for?", "pending": {"summary": "Sync", "duration_minutes": 60}, "awaiting": "time", "intent": "create"}
- "Move my 6pm to 8pm" -> {"action": "reschedule_event", "event_details": {"match": "6pm", "new_time": "today 20:00"}}
- "Cancel my dentist appointment" -> {"action": "delete_event", "event_details": {"match": "dentist"}}
- "Find me 2 hours for deep work" -> {"action": "suggest_time", "event_details": {"summary": "Deep work", "duration_minutes": 120, "preferred_time": "morning"}, "response": "Let me find an optimal slot for deep work."}
- "When should I work on the presentation?" -> {"action": "suggest_time", "event_details": {"summary": "Work on presentation", "duration_minutes": 60, "preferred_time": "morning"}, "response": "Let me find the best time for presentation work."}
- "Start a focus session for 90 minutes on the presentation" -> {"action": "focus_session", "event_details": {"summary": "Focus: presentation", "duration_minutes": 90}, "response": "Starting a 90-minute focus session for presentation work."}
- "Pomodoro for 25 minutes" -> {"action": "focus_session", "event_details": {"summary": "Focus Time", "duration_minutes": 25}, "response": "Starting a 25-minute focus session."}

SUGGEST_TIME RULES:
- Find free slots using the user's work hours (from profile if available)
- Prefer morning slots for deep/focus work
- Avoid slots immediately after meetings (15 min buffer)
- Consider task deadline if mentioned
- Suggest the best slot with explanation

FOCUS_SESSION RULES:
- Create a calendar event immediately blocking the focus time starting NOW
- Default to 90 minutes if no duration specified
- Title format: "Focus: [topic]" or "Focus Time" if no topic given
- Return confirmation with the time block details

Default working hours: 9 AM - 6 PM.
"""


# Keyword-based duration inference (minutes).
_DURATION_KEYWORDS = {
    30: ("call", "quick", "sync", "standup", "stand-up", "1:1", "one-on-one", "catch up", "catch-up", "coffee"),
    90: ("workshop", "session", "training", "deep dive", "deep-dive", "interview", "seminar"),
    # lunch / dinner explicitly default to 60 (handled as default below)
}
_DEFAULT_DURATION = 60

_AFFIRMATIVE = ("yes", "yeah", "yep", "yup", "sure", "ok", "okay", "go ahead", "anyway", "do it", "schedule it", "please do", "confirm")
_NEGATIVE = ("no", "nope", "nah", "cancel", "don't", "do not", "never mind", "nevermind", "forget it", "skip")


def _is_affirmative(text: str) -> bool:
    t = text.strip().lower()
    return any(w in t for w in _AFFIRMATIVE)


def _is_negative(text: str) -> bool:
    t = text.strip().lower()
    return any(w in t for w in _NEGATIVE)


def infer_duration(text: str, default: int = _DEFAULT_DURATION) -> tuple[int, bool]:
    """Infer a sensible duration in minutes from keywords in the text.

    Returns (minutes, inferred) where ``inferred`` is True when a keyword drove
    the choice (so the caller can mention it to the user).
    """
    low = (text or "").lower()
    for minutes, words in _DURATION_KEYWORDS.items():
        if any(w in low for w in words):
            return minutes, True
    return default, False


class SchedulerAgent(AgentBase):
    """Scheduler agent that manages calendar and finds optimal time slots."""

    name = "scheduler"
    description = "Finds optimal time slots and manages calendar events"
    capabilities = [
        "find_free_slots",
        "create_event",
        "list_events",
        "reschedule_event",
        "delete_event",
        "scheduling",
    ]

    def __init__(self, mcp_client: Any = None):
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel(settings.GEMINI_MODEL)

    async def execute(self, task: dict) -> dict:
        """Handle a scheduling request.

        Args:
            task: Dict with 'message', 'auth_token', 'user_id', and optionally
                  'pending_action' (a previously stored clarification/confirmation
                  this message is answering).

        Returns:
            Dict with 'content', 'agent', 'action', and 'pending_action'
            (a dict to remember for the next turn, or None to clear it).
        """
        message = task.get("message", "")
        auth_token = task.get("auth_token", "")
        user_id = task.get("user_id", "")
        pending_action = task.get("pending_action")

        logger.info(
            f"[scheduler] action_msg={message[:50]!r}, has_mcp={bool(self.mcp_client)}, "
            f"has_token={bool(auth_token)}, pending={bool(pending_action)}"
        )

        # Completing a previously stored clarification / confirmation.
        if pending_action:
            return await self._complete_pending(message, pending_action, auth_token, user_id)

        # Fresh request: ask Gemini to classify and extract details.
        plan = await self._analyze_scheduling_request(message)
        return await self._dispatch_plan(plan, auth_token, user_id, source_text=message)

    # ------------------------------------------------------------------
    # Plan dispatch
    # ------------------------------------------------------------------

    async def _dispatch_plan(
        self, plan: dict, auth_token: str, user_id: str, source_text: str
    ) -> dict:
        """Execute the calendar operation described by a plan dict."""
        action = plan.get("action", "find_slots")

        if action == "needs_info":
            return self._build_needs_info(plan, source_text)

        if not (self.mcp_client and auth_token):
            return {
                "content": plan.get("response", "I can help you with scheduling."),
                "agent": self.name,
                "action": action,
                "pending_action": None,
            }

        if action == "list_events":
            events = await self._list_events(auth_token)
            return self._result(self._format_events(events), action)

        if action == "find_slots":
            slots = await self._find_free_slots(auth_token, plan.get("event_details", {}))
            return self._result(
                self._format_free_slots(slots, plan.get("response", "")), action
            )

        if action == "suggest_time":
            return await self._do_suggest_time(auth_token, plan.get("event_details", {}), user_id)

        if action == "focus_session":
            return await self._do_focus_session(auth_token, plan.get("event_details", {}), user_id)

        if action == "create_event":
            return await self._do_create(
                auth_token, plan.get("event_details", {}), user_id, source_text
            )

        if action == "reschedule_event":
            return await self._do_reschedule(
                auth_token, plan.get("event_details", {}), user_id, source_text
            )

        if action == "delete_event":
            return await self._do_delete(auth_token, plan.get("event_details", {}))

        # Unknown action -> safe default.
        return self._result(
            plan.get("response", "I can help you with scheduling."), action
        )

    def _result(self, content: str, action: str, pending: Optional[dict] = None) -> dict:
        return {
            "content": content,
            "agent": self.name,
            "action": action,
            "pending_action": pending,
        }

    # ------------------------------------------------------------------
    # Clarification / slot-filling
    # ------------------------------------------------------------------

    def _build_needs_info(self, plan: dict, source_text: str) -> dict:
        """Turn a Gemini 'needs_info' plan into a result + pending_action."""
        partial = dict(plan.get("pending") or plan.get("event_details") or {})
        if not partial.get("summary"):
            partial["summary"] = "Meeting"
        if not partial.get("duration_minutes"):
            minutes, _ = infer_duration(source_text)
            partial["duration_minutes"] = minutes

        awaiting = plan.get("awaiting") or "time"
        question = plan.get("question") or self._default_question(partial, awaiting)
        intent = plan.get("intent") or "create"

        pending = {
            "agent": self.name,
            "intent": intent,
            "awaiting": awaiting,
            "question": question,
            "partial": partial,
        }
        return self._result(question, "needs_info", pending)

    @staticmethod
    def _default_question(partial: dict, awaiting: str) -> str:
        summary = (partial.get("summary") or "your event").strip()
        date_phrase = (partial.get("start_time") or "").strip()
        if awaiting == "date":
            return f'What day should I schedule "{summary}" for?'
        if date_phrase:
            return f'What time is "{summary}" {date_phrase}?'
        return f'What day and time should I schedule "{summary}" for?'

    async def _complete_pending(
        self, message: str, pending: dict, auth_token: str, user_id: str
    ) -> dict:
        """Apply the user's answer to a stored pending action."""
        awaiting = pending.get("awaiting")
        intent = pending.get("intent", "create")
        partial = dict(pending.get("partial") or {})

        # Confirmation after a conflict warning.
        if awaiting == "confirmation":
            if _is_affirmative(message):
                return await self._do_create(
                    auth_token, partial, user_id, source_text=message, confirmed=True
                )
            if _is_negative(message):
                return self._result(
                    "No problem — I won't schedule that.", "cancel", None
                )
            # Unclear answer: re-ask the same confirmation.
            return self._result(
                pending.get("question", "Should I go ahead and schedule it anyway?"),
                "needs_info",
                pending,
            )

        # Choosing among multiple matches for a delete.
        if awaiting == "which":
            refined = dict(partial)
            refined["match"] = message
            return await self._do_delete(auth_token, refined)

        # ----- Bug fix: preserve stored date context when completing -----
        # The pending partial may store the date phrase in "date_phrase" or in
        # "start_time" (e.g. "tomorrow"). When the user replies with just a
        # time (e.g. "12 pm"), we must combine the stored date with the new
        # time so the resolved datetime lands on the correct day.
        stored_date = (
            partial.get("date_phrase")
            or partial.get("start_time")
            or ""
        ).strip()

        if awaiting in ("time", None) and stored_date:
            # Combine stored date phrase with the user's time answer before
            # sending to _merge_pending, so even the Gemini path sees the full
            # phrase context in the partial.
            partial["date_phrase"] = stored_date
            pending = dict(pending)
            pending["partial"] = partial

        # Filling in a missing time/date for a create (or reschedule).
        merged = await self._merge_pending(message, pending)
        if merged.get("action") == "needs_info":
            # Still missing something -> keep asking.
            return self._build_needs_info(merged, message)

        details = merged.get("event_details", partial)
        if intent == "reschedule":
            return await self._do_reschedule(auth_token, details, user_id, message)
        return await self._do_create(auth_token, details, user_id, message)

    async def _merge_pending(self, message: str, pending: dict) -> dict:
        """Merge the user's slot answer into the pending partial via Gemini.

        Falls back to a deterministic Python merge if the model is unavailable.
        """
        partial = dict(pending.get("partial") or {})
        awaiting = pending.get("awaiting", "time")
        question = pending.get("question", "")

        prompt = f"""{time_context_string()}

{SCHEDULER_PROMPT}

You previously asked the user: "{question}"
What you already know (partial event): {json.dumps(partial)}
The user just replied: "{message}"

Merge the reply into the partial event and produce the completed action JSON.
If after merging you STILL lack a concrete date or time, return action "needs_info" again."""

        text = await self.generate(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            fallback="",
        )
        try:
            plan = json.loads(text)
            if isinstance(plan, dict) and plan.get("action"):
                return plan
        except Exception:
            pass

        # Deterministic fallback merge.
        return self._python_merge(message, partial, awaiting)

    @staticmethod
    def _python_merge(message: str, partial: dict, awaiting: str) -> dict:
        """Best-effort, model-free merge of an answer into a partial event."""
        details = dict(partial)
        reply = message.strip()

        # Handle "same time" references: pull the time from the original event.
        if any(phrase in reply.lower() for phrase in ("same time", "same", "keep the same", "keep it")):
            original = details.get("original_time", "")
            if original:
                # Extract just the time portion from the original ISO datetime
                # and combine with any new date context already in the partial.
                try:
                    orig_dt = datetime.fromisoformat(original.replace("Z", "+00:00"))
                    if orig_dt.tzinfo is None:
                        orig_dt = orig_dt.replace(tzinfo=IST)
                    orig_dt = orig_dt.astimezone(IST)
                    time_str = orig_dt.strftime("%H:%M")
                    # If we have a stored date phrase, combine it with the original time.
                    existing_date = (
                        details.get("date_phrase") or details.get("start_time") or ""
                    ).strip()
                    if existing_date:
                        combined = f"{existing_date} {time_str}"
                    else:
                        combined = original
                    details["start_time"] = combined
                    resolved = resolve_relative(combined, base=now_ist())
                    if resolved:
                        details["start_time"] = resolved
                    intent = "reschedule" if details.get("match") else "create"
                    return {"action": "reschedule_event" if intent == "reschedule" else "create_event", "event_details": details}
                except (ValueError, AttributeError):
                    pass

        # The stored date context may live in "date_phrase" (explicit) or in
        # "start_time" (the raw day/date the user originally gave, e.g.
        # "tomorrow"). We use date_phrase first if available.
        existing = (
            details.get("date_phrase") or details.get("start_time") or ""
        ).strip()

        if awaiting == "date":
            # The reply provides the day; keep any existing time component.
            combined = f"{reply} {existing}".strip()
        else:
            # awaiting time (default): reply provides time; keep existing day.
            combined = f"{existing} {reply}".strip()

        details["start_time"] = combined
        if resolve_relative(combined, base=now_ist()) is None:
            return {
                "action": "needs_info",
                "question": "Sorry, I didn't catch the time -- what time should I use?",
                "pending": details,
                "awaiting": "time",
                "intent": "create",
            }
        return {"action": "create_event", "event_details": details}

    # ------------------------------------------------------------------
    # Smart scheduling: suggest optimal time
    # ------------------------------------------------------------------

    async def _do_suggest_time(
        self, auth_token: str, details: dict, user_id: str
    ) -> dict:
        """Find an optimal time slot for a task based on free slots and preferences."""
        duration = details.get("duration_minutes", 60)
        preferred_time = details.get("preferred_time", "morning")
        summary = details.get("summary", "this task")

        # Fetch free slots
        slots = await self._find_free_slots(auth_token, {
            "duration_minutes": duration,
            "date_range_days": details.get("date_range_days", 3),
        })

        if not slots:
            return self._result(
                f"I couldn't find any free slots of {duration} minutes in the next few days. "
                "Want me to widen the search?",
                "suggest_time",
            )

        # Pick the best slot: prefer morning for focus work, avoid post-meeting
        best_slot = self._pick_optimal_slot(slots, preferred_time)
        if not best_slot:
            best_slot = slots[0] if slots else {}

        start_str = best_slot.get("start", "")
        slot_display = self._human_time(self._parse_event_dt(start_str)) if start_str else "an available time"

        # Build a suggestion with option to confirm
        suggestion = (
            f"I'd suggest {slot_display} for \"{summary}\" "
            f"({duration} minutes). "
            f"Want me to block it on your calendar?"
        )

        # Store pending so user can confirm
        pending = {
            "agent": self.name,
            "intent": "create",
            "awaiting": "confirmation",
            "question": suggestion,
            "partial": {
                "summary": summary,
                "start_time": start_str,
                "duration_minutes": duration,
            },
        }
        return self._result(suggestion, "suggest_time", pending)

    def _pick_optimal_slot(self, slots: list, preferred_time: str) -> dict:
        """Pick the best slot from available options based on preference.

        Prefers morning slots for focus/deep work, afternoon for meetings.
        Avoids very early or very late slots.
        """
        real_slots = [
            s for s in (slots or [])
            if isinstance(s, dict) and not s.get("error") and s.get("start")
        ]
        if not real_slots:
            return {}

        scored = []
        for slot in real_slots:
            dt = self._parse_event_dt(slot.get("start"))
            if dt is None:
                continue
            hour = dt.hour
            score = 0

            if preferred_time == "morning":
                # Prefer 9-12 AM
                if 9 <= hour <= 11:
                    score += 10
                elif 8 <= hour <= 12:
                    score += 5
            elif preferred_time == "afternoon":
                # Prefer 13-17
                if 13 <= hour <= 16:
                    score += 10
                elif 12 <= hour <= 17:
                    score += 5
            else:
                # Any time during work hours
                if 9 <= hour <= 17:
                    score += 5

            # Penalize very early or late
            if hour < 8 or hour > 19:
                score -= 5

            scored.append((score, slot))

        if not scored:
            return real_slots[0]

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    # ------------------------------------------------------------------
    # Focus session: create a time block immediately
    # ------------------------------------------------------------------

    async def _do_focus_session(
        self, auth_token: str, details: dict, user_id: str
    ) -> dict:
        """Create a focus time block on the calendar starting now."""
        duration = details.get("duration_minutes", 90)
        summary = details.get("summary", "Focus Time")

        # Ensure the summary starts with "Focus" for clarity
        if not summary.lower().startswith("focus"):
            summary = f"Focus: {summary}"

        # Start time is NOW
        start_time = now_ist().isoformat()

        event_details = {
            "summary": summary,
            "start_time": start_time,
            "duration_minutes": duration,
            "description": "Focus session - do not disturb",
        }

        if not (self.mcp_client and auth_token):
            return self._result(
                f"Focus session started: {summary} for {duration} minutes. "
                f"(Calendar block not created - no calendar access.)",
                "focus_session",
            )

        result = await self._create_event(auth_token, event_details)
        if result and not (isinstance(result, dict) and result.get("error")):
            if user_id:
                await self._persist_event_to_firestore(user_id, event_details, result)
                # Learn that the user does focused/deep work at this hour.
                await self._record_memory_observation(
                    user_id,
                    "focus_session",
                    {"hour": now_ist().hour, "title": summary},
                )

            end_time = now_ist() + timedelta(minutes=duration)
            end_display = end_time.strftime("%-I:%M %p")
            return self._result(
                f"Focus session started! I've blocked \"{summary}\" for {duration} minutes "
                f"(until {end_display}). Time to get in the zone!",
                "focus_session",
            )

        return self._result(
            f"I'll start your focus session for {duration} minutes, but couldn't "
            f"block it on your calendar. Stay focused!",
            "focus_session",
        )

    # ------------------------------------------------------------------
    # Create (with conflict detection)
    # ------------------------------------------------------------------

    async def _do_create(
        self,
        auth_token: str,
        details: dict,
        user_id: str,
        source_text: str = "",
        confirmed: bool = False,
    ) -> dict:
        """Create an event, asking for a time or confirming conflicts first."""
        details = dict(details or {})
        start_phrase = (details.get("start_time") or "").strip()

        # Resolve to a concrete IST datetime. None => no concrete time given.
        start_iso = resolve_relative(start_phrase, base=now_ist()) if start_phrase else None
        if start_iso is None:
            # Missing time -> ask, never invent.
            return self._build_needs_info(
                {
                    "action": "needs_info",
                    "pending": details,
                    "awaiting": "time",
                    "intent": "create",
                },
                source_text or start_phrase,
            )

        # Lock the resolved absolute time into the details so a later
        # confirmation turn reuses it verbatim.
        details["start_time"] = start_iso

        # Duration: respect an explicit value, otherwise infer from keywords.
        duration_inferred = False
        if not details.get("duration_minutes"):
            minutes, duration_inferred = infer_duration(source_text or details.get("summary", ""))
            details["duration_minutes"] = minutes
        duration_minutes = details.get("duration_minutes", _DEFAULT_DURATION)

        # Conflict detection (one extra list call) unless already confirmed.
        if not confirmed:
            conflict = await self._find_conflict(auth_token, start_iso, duration_minutes)
            if conflict:
                question = self._format_conflict_question(conflict, details)
                pending = {
                    "agent": self.name,
                    "intent": "create",
                    "awaiting": "confirmation",
                    "question": question,
                    "partial": details,
                }
                return self._result(question, "needs_info", pending)

        result = await self._create_event(auth_token, details)
        if result and not (isinstance(result, dict) and result.get("error")):
            if user_id:
                await self._persist_event_to_firestore(user_id, details, result)
            content = self._format_create_confirmation(details, result, duration_inferred)
            return self._result(content, "create_event", None)

        return self._result(
            "I couldn't create that event. Please try again in a moment.",
            "create_event",
            None,
        )

    async def _find_conflict(
        self, auth_token: str, start_iso: str, duration_minutes: int
    ) -> Optional[dict]:
        """Return an existing event overlapping the proposed slot, if any."""
        try:
            start = datetime.fromisoformat(start_iso)
        except (ValueError, AttributeError):
            return None
        if start.tzinfo is None:
            start = start.replace(tzinfo=IST)
        end = start + timedelta(minutes=duration_minutes)

        events = await self._list_events(auth_token)
        for e in events or []:
            if not isinstance(e, dict) or e.get("error"):
                continue
            estart = self._parse_event_dt(e.get("start"))
            if estart is None:
                continue
            eend = self._parse_event_dt(e.get("end")) or (estart + timedelta(minutes=60))
            # Overlap test on the same instant line.
            if estart < end and start < eend:
                return e
        return None

    @staticmethod
    def _parse_event_dt(value: Any) -> Optional[datetime]:
        if not value or not isinstance(value, str):
            return None
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        return dt.astimezone(IST)

    def _format_conflict_question(self, conflict: dict, details: dict) -> str:
        existing = conflict.get("summary") or "another event"
        existing_when = self._parse_event_dt(conflict.get("start"))
        when_str = self._human_time(existing_when) if existing_when else "that time"
        new_summary = (details.get("summary") or "the new event").strip()
        return (
            f'You already have "{existing}" at {when_str}. '
            f'Want me to schedule "{new_summary}" anyway?'
        )

    # ------------------------------------------------------------------
    # Reschedule / delete
    # ------------------------------------------------------------------

    async def _do_reschedule(
        self, auth_token: str, details: dict, user_id: str, source_text: str
    ) -> dict:
        """Move an existing event to a new time (delete + recreate)."""
        details = dict(details or {})
        match = details.get("match") or details.get("summary") or ""
        new_phrase = (details.get("new_time") or details.get("start_time") or "").strip()
        new_iso = resolve_relative(new_phrase, base=now_ist()) if new_phrase else None

        events = await self._list_events(auth_token)
        candidates = self._match_events(events, match)

        if not candidates:
            return self._result(
                f"I couldn't find an event matching \"{match}\" to reschedule.",
                "reschedule_event",
                None,
            )
        if len(candidates) > 1:
            listing = self._format_event_choices(candidates)
            pending = {
                "agent": self.name,
                "intent": "delete",
                "awaiting": "which",
                "question": f"Which one did you mean?\n{listing}",
                "partial": {"match": match},
            }
            return self._result(
                f"I found a few events matching \"{match}\". Which one?\n{listing}",
                "needs_info",
                pending,
            )

        target = candidates[0]

        if new_iso is None:
            # We know which event but not the new time -> ask.
            # Store the original event's start time so "same time" can reference it.
            original_time = target.get("start", "")
            pending = {
                "agent": self.name,
                "intent": "reschedule",
                "awaiting": "time",
                "question": f'What time should I move "{target.get("summary", "the event")}" to?',
                "partial": {
                    "summary": target.get("summary", "Event"),
                    "match": match,
                    "original_time": original_time,
                },
            }
            return self._result(pending["question"], "needs_info", pending)

        # Delete the old occurrence and create the new one.
        event_id = target.get("id", "")
        if event_id:
            await self._delete_event(auth_token, event_id)

        new_details = {
            "summary": target.get("summary", "Event"),
            "description": target.get("description", ""),
            "start_time": new_iso,
            "duration_minutes": self._event_duration(target),
        }
        result = await self._create_event(auth_token, new_details)
        if result and not (isinstance(result, dict) and result.get("error")):
            if user_id:
                await self._persist_event_to_firestore(user_id, new_details, result)
                # Learn which hours the user reschedules AWAY from (avoided) and
                # toward (preferred), so adaptive planning can respect both.
                old_dt = self._parse_event_dt(target.get("start"))
                new_dt = self._parse_event_dt(new_iso)
                await self._record_memory_observation(
                    user_id,
                    "task_rescheduled",
                    {
                        "title": new_details.get("summary", ""),
                        "from_hour": old_dt.hour if old_dt else None,
                        "to_hour": new_dt.hour if new_dt else None,
                    },
                )
            summary = new_details["summary"]
            when = self._human_time(self._parse_event_dt(new_iso))
            return self._result(
                f'Done — moved "{summary}" to {when}.', "reschedule_event", None
            )
        return self._result(
            "I couldn't reschedule that event. Please try again.",
            "reschedule_event",
            None,
        )

    async def _do_delete(self, auth_token: str, details: dict) -> dict:
        """Delete an event matching the user's description."""
        match = (details or {}).get("match") or (details or {}).get("summary") or ""
        events = await self._list_events(auth_token)
        candidates = self._match_events(events, match)

        if not candidates:
            return self._result(
                f"I couldn't find an event matching \"{match}\" to cancel.",
                "delete_event",
                None,
            )
        if len(candidates) > 1:
            listing = self._format_event_choices(candidates)
            pending = {
                "agent": self.name,
                "intent": "delete",
                "awaiting": "which",
                "question": f"Which one did you mean?\n{listing}",
                "partial": {"match": match},
            }
            return self._result(
                f"I found a few events matching \"{match}\". Which one should I cancel?\n{listing}",
                "needs_info",
                pending,
            )

        target = candidates[0]
        event_id = target.get("id", "")
        result = await self._delete_event(auth_token, event_id) if event_id else {"error": "no id"}
        if result and not (isinstance(result, dict) and result.get("error")):
            summary = target.get("summary", "the event")
            when = self._human_time(self._parse_event_dt(target.get("start")))
            suffix = f" ({when})" if when else ""
            return self._result(
                f'Done — cancelled "{summary}"{suffix}.', "delete_event", None
            )
        return self._result(
            "I couldn't cancel that event. Please try again.", "delete_event", None
        )

    def _match_events(self, events: list, match: str) -> list:
        """Find events whose title or time matches the user's description."""
        real = [e for e in (events or []) if isinstance(e, dict) and not e.get("error")]
        if not match:
            return real

        match_low = match.lower().strip()
        # Pull any time tokens (e.g. "6pm", "18:00") from the match string.
        match_time = resolve_relative(match_low, base=now_ist())
        match_hour = None
        if match_time:
            try:
                match_hour = datetime.fromisoformat(match_time).hour
            except ValueError:
                match_hour = None

        scored = []
        for e in real:
            summary = (e.get("summary") or "").lower()
            score = 0
            # Title keyword overlap.
            for word in re.findall(r"[a-z]{3,}", match_low):
                if word in summary:
                    score += 2
            # Time match.
            if match_hour is not None:
                est = self._parse_event_dt(e.get("start"))
                if est is not None and est.hour == match_hour:
                    score += 3
            if score > 0:
                scored.append((score, e))

        if not scored:
            return []
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[0][0]
        return [e for s, e in scored if s == top]

    def _format_event_choices(self, events: list) -> str:
        lines = []
        for e in events:
            summary = e.get("summary") or "Untitled"
            when = self._human_time(self._parse_event_dt(e.get("start")))
            lines.append(f"• {summary} ({when})" if when else f"• {summary}")
        return "\n".join(lines)

    @staticmethod
    def _event_duration(event: dict) -> int:
        start = SchedulerAgent._parse_event_dt(event.get("start"))
        end = SchedulerAgent._parse_event_dt(event.get("end"))
        if start and end and end > start:
            return int((end - start).total_seconds() / 60)
        return _DEFAULT_DURATION

    # ------------------------------------------------------------------
    # Formatting helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _human_time(dt: Optional[datetime]) -> str:
        """Render an IST datetime like 'Sat, 28 Jun at 6:00 PM IST'."""
        if dt is None:
            return ""
        dt = dt.astimezone(IST)
        return dt.strftime("%a, %-d %b at %-I:%M %p") + " IST"

    @staticmethod
    def _format_events(events: list) -> str:
        real_events = [
            e for e in (events or []) if isinstance(e, dict) and not e.get("error")
        ]
        if not real_events:
            return "Your calendar is clear this week!"
        lines = [f"You have {len(real_events)} event(s) coming up:"]
        for e in real_events:
            summary = e.get("summary") or "Untitled event"
            when = SchedulerAgent._format_when(e.get("start", ""))
            lines.append(f"• {when}{summary}" if when else f"• {summary}")
        return "\n".join(lines)

    @staticmethod
    def _format_when(start: str) -> str:
        if not start:
            return ""
        try:
            dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return ""
        if dt.tzinfo is not None:
            dt = dt.astimezone(IST)
        day = dt.strftime("%a")
        hour = dt.hour % 12 or 12
        ampm = "am" if dt.hour < 12 else "pm"
        if dt.minute:
            return f"{day} {hour}:{dt.minute:02d}{ampm} — "
        return f"{day} {hour}{ampm} — "

    @staticmethod
    def _format_free_slots(slots: list, intro: str) -> str:
        real_slots = [
            s for s in (slots or []) if isinstance(s, dict) and not s.get("error")
        ]
        if not real_slots:
            return "I couldn't find any open slots in that window. Want me to widen the search?"
        lines = [intro.strip() or "Here are some open slots:"]
        for s in real_slots[:5]:
            when = SchedulerAgent._format_when(s.get("start", ""))
            mins = s.get("duration_minutes", "")
            label = f"• {when}".rstrip(" —") if when else "• slot"
            if mins:
                label += f" ({mins} min free)"
            lines.append(label)
        return "\n".join(lines)

    @staticmethod
    def _format_create_confirmation(
        event_details: dict, result: dict, duration_inferred: bool = False
    ) -> str:
        """Friendly confirmation with the resolved absolute IST day + time."""
        summary = event_details.get("summary", "Event") or "Event"
        display_summary = summary[0].upper() + summary[1:] if summary else "Event"

        start_iso = ""
        if isinstance(result, dict):
            start_iso = result.get("start", "")
        if not start_iso:
            start_iso = event_details.get("start_time", "")

        when = ""
        if start_iso:
            try:
                dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=IST)
                when = SchedulerAgent._human_time(dt)
            except (ValueError, AttributeError):
                when = ""

        if when:
            msg = f'Done — "{display_summary}" on {when}.'
        else:
            msg = f'Done — I\'ve added "{display_summary}" to your calendar.'

        if duration_inferred:
            minutes = event_details.get("duration_minutes", _DEFAULT_DURATION)
            msg += f" (I set it to {minutes} minutes — let me know to change that.)"
        return msg

    # ------------------------------------------------------------------
    # Gemini analysis
    # ------------------------------------------------------------------

    async def _analyze_scheduling_request(self, message: str) -> dict:
        """Use Gemini (grounded in IST) to analyze a scheduling request."""
        prompt = f"""{time_context_string()}

{SCHEDULER_PROMPT}

Scheduling request: {message}"""

        text = await self.generate(
            prompt,
            generation_config={"response_mime_type": "application/json"},
            fallback="",
        )
        try:
            return json.loads(text)
        except Exception:
            return {
                "action": "find_slots",
                "event_details": {"summary": message, "duration_minutes": 60},
                "response": f"I'll help you find time for: {message}",
            }

    # ------------------------------------------------------------------
    # MCP calendar operations
    # ------------------------------------------------------------------

    async def _list_events(self, auth_token: str) -> list:
        try:
            result = await self.call_mcp_tool(
                "google-calendar",
                "list_events",
                {"auth_token": auth_token, "days_ahead": 7},
            )
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.error(f"[scheduler] _list_events failed: {e}", exc_info=True)
            return []

    async def _find_free_slots(self, auth_token: str, details: dict) -> list:
        try:
            return await self.call_mcp_tool(
                "google-calendar",
                "find_free_slots",
                {
                    "auth_token": auth_token,
                    "duration_minutes": details.get("duration_minutes", 60),
                    "days_ahead": details.get("date_range_days", 7),
                },
            )
        except Exception as e:
            logger.error(f"[scheduler] _find_free_slots failed: {e}", exc_info=True)
            return []

    async def _create_event(self, auth_token: str, details: dict) -> dict:
        try:
            start_time_raw = details.get("start_time", "")
            start_time_iso = self._resolve_start_time(start_time_raw) if start_time_raw else None

            tool_args = {
                "auth_token": auth_token,
                "summary": details.get("summary", "New Event"),
                "description": details.get("description", ""),
                "duration_minutes": details.get("duration_minutes", 60),
            }
            if start_time_iso:
                tool_args["start_time"] = start_time_iso

            return await self.call_mcp_tool(
                "google-calendar", "create_event", tool_args
            )
        except Exception as e:
            logger.error(f"[scheduler] _create_event failed: {e}", exc_info=True)
            return {}

    async def _delete_event(self, auth_token: str, event_id: str) -> dict:
        try:
            return await self.call_mcp_tool(
                "google-calendar",
                "delete_event",
                {"auth_token": auth_token, "event_id": event_id},
            )
        except Exception as e:
            logger.error(f"[scheduler] _delete_event failed: {e}", exc_info=True)
            return {"error": str(e)}

    @staticmethod
    def _resolve_start_time(time_str: str) -> str:
        """Convert a relative time phrase to an IST-offset ISO datetime string.

        - ISO strings (starting YYYY-MM-DDT) pass through unchanged.
        - Relative phrases resolve via timectx.resolve_relative (Asia/Kolkata).
        - If nothing resolves, default to the next full hour in IST.
        """
        time_str = (time_str or "").strip()

        # Already ISO (date+time) -> pass through unchanged.
        if re.match(r"^\d{4}-\d{2}-\d{2}T", time_str):
            return time_str

        resolved = resolve_relative(time_str, base=now_ist())
        if resolved:
            return resolved

        # Fallback: next full hour, in IST.
        target = now_ist().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        return target.isoformat()

    async def _record_memory_observation(
        self, user_id: str, obs_type: str, data: dict
    ) -> None:
        """Record a behavioural signal for learning. Best-effort, never raises."""
        if not user_id:
            return
        try:
            from app.agents.memory import record_observation

            await record_observation(user_id, obs_type, data)
        except Exception as e:
            logger.warning(f"[scheduler] memory observation failed: {e}")

    async def _persist_event_to_firestore(
        self, user_id: str, event_details: dict, result: dict
    ) -> None:
        try:
            db = get_db()
            event_doc = {
                "user_id": user_id,
                "summary": event_details.get("summary", ""),
                "description": event_details.get("description", ""),
                "duration_minutes": event_details.get("duration_minutes", 60),
                "calendar_result": result if isinstance(result, dict) else {},
                "created_at": now_ist(),
            }
            await db.collection("scheduled_events").document().set(event_doc)
        except Exception:
            pass
