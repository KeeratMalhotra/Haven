"""Shared Pydantic models for ChronAI."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Types of messages that can be sent via WebSocket."""

    CHAT = "chat"
    VOICE = "voice"


class ResponseType(str, Enum):
    """Types of responses from the backend."""

    TEXT = "text"
    AUDIO = "audio"
    TASK_UPDATE = "task_update"
    STATUS = "status"
    ERROR = "error"


class WebSocketMessage(BaseModel):
    """Message received from the frontend via WebSocket."""

    type: MessageType
    content: str
    auth_token: str = ""


class AgentResponse(BaseModel):
    """Response sent from the backend to the frontend."""

    type: ResponseType
    content: str
    agent: str


class TaskItem(BaseModel):
    """A task item representation."""

    id: str = ""
    title: str
    notes: str = ""
    due: Optional[datetime] = None
    completed: bool = False
    subtasks: list["TaskItem"] = Field(default_factory=list)


class CalendarEvent(BaseModel):
    """A calendar event representation."""

    id: str = ""
    summary: str
    description: str = ""
    start: datetime
    end: datetime
    location: str = ""
    attendees: list[str] = Field(default_factory=list)


class ChatMessage(BaseModel):
    """A chat message in conversation history."""

    role: str  # "user" or "assistant"
    content: str
    agent: str = ""
    timestamp: datetime = Field(default_factory=datetime.now)
