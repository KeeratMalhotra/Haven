"""Tests for Firestore repositories.

All tests use the mock_firestore fixture (in-memory dict-based mock)
that mimics the async Firestore API.
"""

from datetime import datetime

import pytest

from app.db.models import User, Task, Habit, Conversation
from app.db.repositories import (
    UserRepository,
    TaskRepository,
    HabitRepository,
    ConversationRepository,
)


class TestUserRepository:
    """Tests for UserRepository CRUD operations."""

    async def test_user_create_and_get(self):
        """Create a user, retrieve by ID."""
        user = User(
            id="user1",
            email="alice@example.com",
            name="Alice",
            preferences={"theme": "dark"},
        )
        created = await UserRepository.create(user)
        assert created.id == "user1"

        retrieved = await UserRepository.get_by_id("user1")
        assert retrieved is not None
        assert retrieved.email == "alice@example.com"
        assert retrieved.name == "Alice"

    async def test_user_get_by_email(self):
        """Create user, find by email."""
        user = User(
            id="user2",
            email="bob@example.com",
            name="Bob",
        )
        await UserRepository.create(user)

        found = await UserRepository.get_by_email("bob@example.com")
        assert found is not None
        assert found.name == "Bob"
        assert found.id == "user2"

    async def test_user_get_nonexistent(self):
        """Get a user that does not exist returns None."""
        result = await UserRepository.get_by_id("nonexistent")
        assert result is None

    async def test_user_update(self):
        """Update user fields."""
        user = User(id="user3", email="carol@example.com", name="Carol")
        await UserRepository.create(user)

        await UserRepository.update("user3", {"name": "Carol Updated"})

        updated = await UserRepository.get_by_id("user3")
        assert updated is not None
        assert updated.name == "Carol Updated"


class TestTaskRepository:
    """Tests for TaskRepository CRUD operations."""

    async def test_task_create_and_list(self):
        """Create tasks for a user, list them."""
        task1 = Task(
            user_id="user1",
            title="Write tests",
            description="Write unit tests for the project",
            priority="high",
            status="pending",
        )
        task2 = Task(
            user_id="user1",
            title="Review PR",
            description="Review the pull request",
            priority="medium",
            status="pending",
        )
        created1 = await TaskRepository.create(task1)
        created2 = await TaskRepository.create(task2)

        assert created1.id != ""
        assert created2.id != ""

        tasks = await TaskRepository.list_by_user("user1")
        assert len(tasks) == 2
        titles = {t.title for t in tasks}
        assert "Write tests" in titles
        assert "Review PR" in titles

    async def test_task_update_and_delete(self):
        """Update task fields, delete task."""
        task = Task(
            user_id="user1",
            title="Original Title",
            status="pending",
        )
        created = await TaskRepository.create(task)
        task_id = created.id

        await TaskRepository.update(task_id, {"title": "Updated Title", "status": "in_progress"})

        updated = await TaskRepository.get_by_id(task_id)
        assert updated is not None
        assert updated.title == "Updated Title"
        assert updated.status == "in_progress"

        await TaskRepository.delete(task_id)
        deleted = await TaskRepository.get_by_id(task_id)
        assert deleted is None


class TestHabitRepository:
    """Tests for HabitRepository operations."""

    async def test_habit_create_and_record(self):
        """Create habit, record completion, verify streak."""
        habit = Habit(
            user_id="user1",
            name="Morning Exercise",
            frequency="daily",
            streak=0,
        )
        created = await HabitRepository.create(habit)
        assert created.id != ""

        # Record completion
        await HabitRepository.record_completion(created.id)

        # Verify streak incremented
        updated = await HabitRepository.get_by_id(created.id)
        assert updated is not None
        assert updated.streak == 1
        assert updated.last_completed is not None

    async def test_habit_list_by_user(self):
        """List habits for a user."""
        habit1 = Habit(user_id="user2", name="Reading", frequency="daily")
        habit2 = Habit(user_id="user2", name="Meditation", frequency="daily")
        await HabitRepository.create(habit1)
        await HabitRepository.create(habit2)

        habits = await HabitRepository.list_by_user("user2")
        assert len(habits) == 2
        names = {h.name for h in habits}
        assert "Reading" in names
        assert "Meditation" in names


class TestConversationRepository:
    """Tests for ConversationRepository operations."""

    async def test_conversation_create_and_add_message(self):
        """Create conversation, add messages."""
        convo = Conversation(
            user_id="user1",
            messages=[],
        )
        created = await ConversationRepository.create(convo)
        assert created.id != ""

        # Add messages
        await ConversationRepository.add_message(
            created.id,
            {"role": "user", "content": "Hello!"},
        )
        await ConversationRepository.add_message(
            created.id,
            {"role": "assistant", "content": "Hi there!"},
        )

        # Verify messages
        retrieved = await ConversationRepository.get_by_id(created.id)
        assert retrieved is not None
        assert len(retrieved.messages) == 2
        assert retrieved.messages[0]["role"] == "user"
        assert retrieved.messages[0]["content"] == "Hello!"
        assert retrieved.messages[1]["role"] == "assistant"

    async def test_conversation_list_by_user(self):
        """List conversations for a user."""
        c1 = Conversation(user_id="user3", messages=[{"role": "user", "content": "msg1"}])
        c2 = Conversation(user_id="user3", messages=[{"role": "user", "content": "msg2"}])
        await ConversationRepository.create(c1)
        await ConversationRepository.create(c2)

        conversations = await ConversationRepository.list_by_user("user3")
        assert len(conversations) == 2
