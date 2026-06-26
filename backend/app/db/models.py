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
    preferences: dict = Field(default_factory=dict)
    profile: UserProfile = Field(default_factory=UserProfile)
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
    streak: int = 0
    last_completed: Optional[datetime] = None
    history: list = Field(default_factory=list)


class Conversation(BaseModel):
    """Conversation history model."""

    id: str = ""
    user_id: str = ""
    messages: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
