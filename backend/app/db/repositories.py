"""CRUD repositories for Firestore collections.

Each repository operates on a specific collection and uses async
Firestore operations via the get_db() client.
"""

from datetime import datetime
from typing import Optional

from app.db.firestore import get_db
from app.db.models import User, Task, Habit, Conversation


class UserRepository:
    """Repository for User documents in the 'users' collection."""

    COLLECTION = "users"

    @classmethod
    async def get_by_id(cls, user_id: str) -> Optional[User]:
        """Get a user by document ID.

        Args:
            user_id: The Firestore document ID.

        Returns:
            User instance or None if not found.
        """
        db = get_db()
        doc = await db.collection(cls.COLLECTION).document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return User(**data)
        return None

    @classmethod
    async def get_by_email(cls, email: str) -> Optional[User]:
        """Get a user by email address.

        Args:
            email: The user's email address.

        Returns:
            User instance or None if not found.
        """
        db = get_db()
        query = db.collection(cls.COLLECTION).where("email", "==", email).limit(1)
        docs = [doc async for doc in query.stream()]
        if docs:
            data = docs[0].to_dict()
            data["id"] = docs[0].id
            return User(**data)
        return None

    @classmethod
    async def create(cls, user: User) -> User:
        """Create a new user document.

        Args:
            user: User model instance to persist.

        Returns:
            User with updated ID from Firestore.
        """
        db = get_db()
        data = user.model_dump(exclude={"id"})
        if user.id:
            await db.collection(cls.COLLECTION).document(user.id).set(data)
            return user
        else:
            doc_ref = db.collection(cls.COLLECTION).document()
            await doc_ref.set(data)
            user.id = doc_ref.id
            return user

    @classmethod
    async def update(cls, user_id: str, data: dict) -> None:
        """Update user fields.

        Args:
            user_id: The Firestore document ID.
            data: Dictionary of fields to update.
        """
        db = get_db()
        await db.collection(cls.COLLECTION).document(user_id).update(data)

    @classmethod
    async def update_tokens(cls, user_id: str, tokens: dict) -> None:
        """Update the user's Google OAuth tokens.

        Args:
            user_id: The Firestore document ID.
            tokens: New token dictionary.
        """
        await cls.update(user_id, {"google_tokens": tokens})


class TaskRepository:
    """Repository for Task documents in the 'tasks' collection."""

    COLLECTION = "tasks"

    @classmethod
    async def get_by_id(cls, task_id: str) -> Optional[Task]:
        """Get a task by document ID.

        Args:
            task_id: The Firestore document ID.

        Returns:
            Task instance or None if not found.
        """
        db = get_db()
        doc = await db.collection(cls.COLLECTION).document(task_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return Task(**data)
        return None

    @classmethod
    async def list_by_user(cls, user_id: str) -> list[Task]:
        """List all tasks for a user.

        Args:
            user_id: The user's ID.

        Returns:
            List of Task instances.
        """
        db = get_db()
        query = db.collection(cls.COLLECTION).where("user_id", "==", user_id)
        tasks = []
        async for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            tasks.append(Task(**data))
        return tasks

    @classmethod
    async def create(cls, task: Task) -> Task:
        """Create a new task document.

        Args:
            task: Task model instance to persist.

        Returns:
            Task with updated ID from Firestore.
        """
        db = get_db()
        data = task.model_dump(exclude={"id"})
        if task.id:
            await db.collection(cls.COLLECTION).document(task.id).set(data)
            return task
        else:
            doc_ref = db.collection(cls.COLLECTION).document()
            await doc_ref.set(data)
            task.id = doc_ref.id
            return task

    @classmethod
    async def update(cls, task_id: str, data: dict) -> None:
        """Update task fields.

        Args:
            task_id: The Firestore document ID.
            data: Dictionary of fields to update.
        """
        db = get_db()
        data["updated_at"] = datetime.utcnow()
        await db.collection(cls.COLLECTION).document(task_id).update(data)

    @classmethod
    async def delete(cls, task_id: str) -> None:
        """Delete a task document.

        Args:
            task_id: The Firestore document ID.
        """
        db = get_db()
        await db.collection(cls.COLLECTION).document(task_id).delete()


class HabitRepository:
    """Repository for Habit documents in the 'habits' collection."""

    COLLECTION = "habits"

    @classmethod
    async def get_by_id(cls, habit_id: str) -> Optional[Habit]:
        """Get a habit by document ID.

        Args:
            habit_id: The Firestore document ID.

        Returns:
            Habit instance or None if not found.
        """
        db = get_db()
        doc = await db.collection(cls.COLLECTION).document(habit_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return Habit(**data)
        return None

    @classmethod
    async def list_by_user(cls, user_id: str) -> list[Habit]:
        """List all habits for a user.

        Args:
            user_id: The user's ID.

        Returns:
            List of Habit instances.
        """
        db = get_db()
        query = db.collection(cls.COLLECTION).where("user_id", "==", user_id)
        habits = []
        async for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            habits.append(Habit(**data))
        return habits

    @classmethod
    async def create(cls, habit: Habit) -> Habit:
        """Create a new habit document.

        Args:
            habit: Habit model instance to persist.

        Returns:
            Habit with updated ID from Firestore.
        """
        db = get_db()
        data = habit.model_dump(exclude={"id"})
        if habit.id:
            await db.collection(cls.COLLECTION).document(habit.id).set(data)
            return habit
        else:
            doc_ref = db.collection(cls.COLLECTION).document()
            await doc_ref.set(data)
            habit.id = doc_ref.id
            return habit

    @classmethod
    async def update_streak(cls, habit_id: str, streak: int) -> None:
        """Update the streak count for a habit.

        Args:
            habit_id: The Firestore document ID.
            streak: New streak value.
        """
        db = get_db()
        await db.collection(cls.COLLECTION).document(habit_id).update(
            {"streak": streak}
        )

    @classmethod
    async def record_completion(cls, habit_id: str) -> None:
        """Record a habit completion, updating streak and history.

        Args:
            habit_id: The Firestore document ID.
        """
        db = get_db()
        doc = await db.collection(cls.COLLECTION).document(habit_id).get()
        if doc.exists:
            data = doc.to_dict()
            now = datetime.utcnow()
            streak = data.get("streak", 0) + 1
            history = data.get("history", [])
            history.append({"completed_at": now.isoformat()})
            await db.collection(cls.COLLECTION).document(habit_id).update(
                {
                    "streak": streak,
                    "last_completed": now,
                    "history": history,
                }
            )


class ConversationRepository:
    """Repository for Conversation documents in the 'conversations' collection."""

    COLLECTION = "conversations"

    @classmethod
    async def get_by_id(cls, conversation_id: str) -> Optional[Conversation]:
        """Get a conversation by document ID.

        Args:
            conversation_id: The Firestore document ID.

        Returns:
            Conversation instance or None if not found.
        """
        db = get_db()
        doc = await db.collection(cls.COLLECTION).document(conversation_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return Conversation(**data)
        return None

    @classmethod
    async def list_by_user(cls, user_id: str) -> list[Conversation]:
        """List all conversations for a user.

        Args:
            user_id: The user's ID.

        Returns:
            List of Conversation instances.
        """
        db = get_db()
        query = db.collection(cls.COLLECTION).where("user_id", "==", user_id)
        conversations = []
        async for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            conversations.append(Conversation(**data))
        return conversations

    @classmethod
    async def create(cls, conversation: Conversation) -> Conversation:
        """Create a new conversation document.

        Args:
            conversation: Conversation model instance to persist.

        Returns:
            Conversation with updated ID from Firestore.
        """
        db = get_db()
        data = conversation.model_dump(exclude={"id"})
        if conversation.id:
            await db.collection(cls.COLLECTION).document(conversation.id).set(data)
            return conversation
        else:
            doc_ref = db.collection(cls.COLLECTION).document()
            await doc_ref.set(data)
            conversation.id = doc_ref.id
            return conversation

    @classmethod
    async def add_message(cls, conversation_id: str, message: dict) -> None:
        """Append a message to a conversation.

        Args:
            conversation_id: The Firestore document ID.
            message: Message dictionary to append.
        """
        db = get_db()
        doc = await db.collection(cls.COLLECTION).document(conversation_id).get()
        if doc.exists:
            data = doc.to_dict()
            messages = data.get("messages", [])
            messages.append(message)
            await db.collection(cls.COLLECTION).document(conversation_id).update(
                {"messages": messages}
            )
