"""Pydantic data models for Firestore documents."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    """User onboarding profile with scheduling preferences."""

    role: str = ""  # student, professional, entrepreneur, freelancer, other
    occupation: str = ""  # e.g. "software engineer", "medical student"
    work_hours_start: int = 9  # 24h format
    work_hours_end: int = 18
    wake_time: int = 7
    sleep_time: int = 23
    priorities: list[str] = Field(default_factory=list)
    daily_routine: str = ""
    goals: list[str] = Field(default_factory=list)
    onboarding_complete: bool = False


class User(BaseModel):
    """User profile model."""

    id: str = ""
    email: str = ""
    name: str = ""
    google_tokens: dict = Field(default_factory=dict)
    connected_services: dict = Field(default_factory=dict)
    spotify_tokens: dict = Field(default_factory=dict)
    preferences: dict = Field(default_factory=dict)
    notification_preferences: dict = Field(
        default_factory=lambda: {
            "email_notifications": True,
            "email_for_urgent_only": False,
            "email_deadline_reminders": True,
            "daily_digest": False,
            "weekly_review": False,
        }
    )
    profile: UserProfile = Field(default_factory=UserProfile)
    # App-wide engagement streak (consecutive days the user planned/engaged).
    streak: int = 0
    longest_streak: int = 0
    last_active_date: str = ""  # ISO date (YYYY-MM-DD) in IST of last engagement
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Task(BaseModel):
    """Task model with subtasks and deadlines."""

    id: str = ""
    user_id: str = ""
    title: str = ""
    description: str = ""
    subtasks: list = Field(default_factory=list)
    priority: str = "medium"
    status: str = "pending"
    deadline: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Habit(BaseModel):
    """Habit tracking model."""

    id: str = ""
    user_id: str = ""
    name: str = ""
    frequency: str = "daily"
    target_days: int = 7
    streak: int = 0
    last_completed: Optional[datetime] = None
    history: list = Field(default_factory=list)


class Conversation(BaseModel):
    """Conversation history model."""

    id: str = ""
    user_id: str = ""
    messages: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Notification(BaseModel):
    """A persisted notification in the user's inbox.

    Every proactive nudge, suggestion, reminder, autopilot summary and
    milestone is written here so nothing the chief-of-staff says is ever lost.
    The inbox is the durable record; toasts are the ephemeral surface.
    """

    id: str = ""
    user_id: str = ""
    title: str = ""
    message: str = ""
    # nudge | suggestion | reminder | autopilot_summary | milestone | proactive
    type: str = "nudge"
    # Proactivity tier this notification came from (1 ambient, 2 nudge, 3 active).
    tier: int = 2
    # The intervention family (e.g. "overcommitment") when sourced from the
    # proactive intelligence engine; empty for generic notifications.
    source: str = ""
    # A single one-tap action: {"label", "kind", "target"?, "message"?, "payload"?}.
    # kind is one of: open_chat | plan_day | navigate | none.
    action: Optional[dict] = None
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ProactiveState(BaseModel):
    """Per-user governance state for the proactive intelligence engine.

    Tracks the daily nudge budget, learned calibration (accept vs dismiss),
    a per-intervention cooldown so the same observation never fires twice in a
    day, and whether a focus session is currently active (nudges are suppressed
    while it is). Stored as a single document keyed by ``user_id``.
    """

    user_id: str = ""
    # ISO date (YYYY-MM-DD, IST) the daily counters below apply to.
    date: str = ""
    # Number of Tier 2+ nudges already delivered today.
    nudge_count: int = 0
    # Rolling lifetime calibration counters.
    accepted: int = 0
    dismissed: int = 0
    # Whether the user is in a focus session right now (suppress nudges).
    focus_active: bool = False
    # Map of intervention type -> ISO date it last fired (daily dedup).
    last_fired: dict = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BehavioralStats(BaseModel):
    """Aggregated behavioral statistics distilled from raw observations.

    These are recomputed deterministically every time an observation is
    recorded, so they stay accurate even if the Gemini distillation step is
    unavailable.
    """

    tasks_created: int = 0
    tasks_completed: int = 0
    tasks_rescheduled: int = 0
    focus_sessions: int = 0
    # Completion rate in [0, 1] = tasks_completed / tasks_created.
    completion_rate: float = 0.0
    # Estimate accuracy in [0, 1]: 1.0 means estimates match reality perfectly.
    # Derived from the average ratio between estimated and actual durations.
    estimate_accuracy: float = 0.0
    # How many task-estimate samples backed the estimate_accuracy figure.
    estimate_samples: int = 0


class MemoryInsight(BaseModel):
    """A single human-readable insight ChronAI has learned about the user.

    Each insight carries a stable ``id`` so the transparency UI can let the
    user forget individual insights without touching the rest of memory.
    """

    id: str = ""
    text: str = ""
    # One of: productivity | pattern | preference | behavior.
    category: str = "pattern"
    # "computed" (deterministic) or "distilled" (Gemini-authored).
    source: str = "computed"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserMemory(BaseModel):
    """Persistent, per-user memory — ChronAI's learning + competitive moat.

    Stored as a single document keyed by ``user_id`` in the ``user_memory``
    collection. It blends deterministically-computed structure (productive
    hours, behavioral stats) with Gemini-distilled, human-readable insights.

    Raw ``observations`` are capped (see MemoryRepository.MAX_OBSERVATIONS) so
    the document stays small and cheap to read on every prompt.
    """

    user_id: str = ""
    # Hours (0-23, IST) when the user actually completes work / focuses, most
    # productive first.
    productive_hours: list[int] = Field(default_factory=list)
    # Hours the user reliably skips/reschedules away from — avoid scheduling.
    avoided_hours: list[int] = Field(default_factory=list)
    # Recurring behaviours / commonly created task types, human-readable.
    task_patterns: list[str] = Field(default_factory=list)
    # Preferences learned over time (e.g. {"preferred_meeting_time": "morning"}).
    learned_preferences: dict = Field(default_factory=dict)
    # Vocabulary / aliases: a simple key -> meaning map ("the report" -> "...").
    vocabulary: dict = Field(default_factory=dict)
    behavioral_stats: BehavioralStats = Field(default_factory=BehavioralStats)
    # Distilled, readable insights surfaced on the transparency page.
    insights: list[MemoryInsight] = Field(default_factory=list)
    # Raw behavioural signals (capped), used to recompute stats + distill.
    observations: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_distilled_at: Optional[datetime] = None
