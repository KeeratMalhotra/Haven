"""Pydantic data models for Firestore documents."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class User(BaseModel):
    """User profile model."""

    id: str = ""
    email: str = ""
    name: str = ""
    google_tokens: dict = Field(default_factory=dict)
    preferences: dict = Field(default_factory=dict)
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
