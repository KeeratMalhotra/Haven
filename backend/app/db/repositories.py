"""CRUD repositories for Firestore collections.

Each repository operates on a specific collection and uses async
Firestore operations via the get_db() client.
"""

from datetime import datetime
from typing import Optional

from app.db.firestore import get_db
from app.db.models import User, Task, Habit, Conversation, UserMemory


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
    async def list_all(cls) -> list[User]:
        """List all users.

        Returns:
            List of all User instances.
        """
        db = get_db()
        users = []
        async for doc in db.collection(cls.COLLECTION).stream():
            data = doc.to_dict()
            data["id"] = doc.id
            users.append(User(**data))
        return users

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

    @classmethod
    async def record_engagement(cls, user_id: str, today: str) -> dict:
        """Record a daily engagement and update the user's streak.

        Streak rules:
        - First ever engagement -> streak becomes 1.
        - Engaging on the same day again -> no change (idempotent).
        - Engaging the day after the last active date -> streak + 1.
        - Engaging after a gap of more than one day -> streak resets to 1.

        Args:
            user_id: The Firestore document ID.
            today: Today's date as an ISO string (YYYY-MM-DD), caller-provided
                so the timezone policy stays consistent across the app.

        Returns:
            Dict with the updated 'streak', 'longest_streak', 'last_active_date',
            and whether this call 'incremented' the streak.
        """
        from datetime import date, timedelta

        user = await cls.get_by_id(user_id)
        if not user:
            return {
                "streak": 0,
                "longest_streak": 0,
                "last_active_date": "",
                "incremented": False,
            }

        last_active = user.last_active_date or ""
        current_streak = user.streak or 0
        longest = user.longest_streak or 0

        if last_active == today:
            # Already counted today; return current values unchanged.
            return {
                "streak": current_streak,
                "longest_streak": max(longest, current_streak),
                "last_active_date": last_active,
                "incremented": False,
            }

        # Determine whether the last engagement was exactly yesterday.
        new_streak = 1
        if last_active:
            try:
                last_date = date.fromisoformat(last_active)
                today_date = date.fromisoformat(today)
                if today_date - last_date == timedelta(days=1):
                    new_streak = current_streak + 1
                elif today_date <= last_date:
                    # Clock skew / out-of-order: keep the existing streak.
                    new_streak = max(current_streak, 1)
                else:
                    new_streak = 1
            except ValueError:
                new_streak = 1

        new_longest = max(longest, new_streak)
        await cls.update(
            user_id,
            {
                "streak": new_streak,
                "longest_streak": new_longest,
                "last_active_date": today,
            },
        )
        return {
            "streak": new_streak,
            "longest_streak": new_longest,
            "last_active_date": today,
            "incremented": True,
        }


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
    async def record_completion(cls, habit_id: str) -> bool:
        """Record a habit completion, updating streak and history.

        Performs same-day deduplication: if the habit was already completed
        today, the call is a no-op and returns False.

        Args:
            habit_id: The Firestore document ID.

        Returns:
            True if the completion was recorded, False if already completed today.
        """
        db = get_db()
        doc = await db.collection(cls.COLLECTION).document(habit_id).get()
        if doc.exists:
            data = doc.to_dict()
            now = datetime.utcnow()
            today = now.date()

            # Same-day deduplication: skip if already completed today
            last_completed = data.get("last_completed")
            if last_completed is not None:
                if hasattr(last_completed, "date"):
                    last_date = last_completed.date()
                elif isinstance(last_completed, str):
                    last_date = datetime.fromisoformat(last_completed).date()
                else:
                    last_date = None
                if last_date == today:
                    return False

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
            return True
        return False

    @classmethod
    async def delete(cls, habit_id: str) -> None:
        """Delete a habit document.

        Args:
            habit_id: The Firestore document ID.
        """
        db = get_db()
        await db.collection(cls.COLLECTION).document(habit_id).delete()

    @classmethod
    async def get_by_name_and_user(cls, name: str, user_id: str) -> Optional[Habit]:
        """Find a habit by name for a given user (case-insensitive substring match).

        Args:
            name: The habit name (or partial name) to search for.
            user_id: The user's ID.

        Returns:
            The first matching Habit instance, or None if not found.
        """
        db = get_db()
        query = db.collection(cls.COLLECTION).where("user_id", "==", user_id)
        name_lower = name.lower()
        async for doc in query.stream():
            data = doc.to_dict()
            if name_lower in data.get("name", "").lower():
                data["id"] = doc.id
                return Habit(**data)
        return None


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



class MemoryRepository:
    """Repository for per-user UserMemory documents in 'user_memory'.

    The document ID is the user's ID, so a user has exactly one memory record.
    All reads degrade gracefully: a missing document yields a fresh, empty
    UserMemory rather than raising, so agents can always rely on getting a
    usable object back.
    """

    COLLECTION = "user_memory"
    # Cap raw observations so the document stays small and cheap to read on
    # every prompt. Oldest observations are dropped first.
    MAX_OBSERVATIONS = 500

    @classmethod
    async def get_memory(cls, user_id: str) -> UserMemory:
        """Get the user's memory document, or a fresh empty one if absent.

        Args:
            user_id: The Firestore document ID (the user's ID).

        Returns:
            A UserMemory instance (never None). On any read error, returns an
            empty UserMemory so callers degrade gracefully.
        """
        if not user_id:
            return UserMemory()
        try:
            db = get_db()
            doc = await db.collection(cls.COLLECTION).document(user_id).get()
            if doc.exists:
                data = doc.to_dict() or {}
                data["user_id"] = user_id
                return UserMemory(**data)
        except Exception:
            # Memory must never break the main flow — fall through to empty.
            pass
        return UserMemory(user_id=user_id)

    @classmethod
    async def save_memory(cls, memory: UserMemory) -> None:
        """Persist a full UserMemory document (overwrites existing).

        Args:
            memory: The UserMemory instance to store. Its ``user_id`` is used
                as the document ID.
        """
        if not memory.user_id:
            return
        memory.updated_at = datetime.utcnow()
        db = get_db()
        data = memory.model_dump(exclude={"user_id"})
        await db.collection(cls.COLLECTION).document(memory.user_id).set(data)

    @classmethod
    async def update_memory(cls, user_id: str, partial: dict) -> UserMemory:
        """Merge a partial update into the user's memory and persist it.

        Args:
            user_id: The user's ID.
            partial: Dict of UserMemory fields to overwrite.

        Returns:
            The updated UserMemory instance.
        """
        memory = await cls.get_memory(user_id)
        merged = memory.model_dump()
        merged.update(partial)
        merged["user_id"] = user_id
        updated = UserMemory(**merged)
        await cls.save_memory(updated)
        return updated

    @classmethod
    async def record_observation(
        cls, user_id: str, observation: dict
    ) -> UserMemory:
        """Append a raw behavioural observation, capping the stored history.

        This only persists the raw signal; statistical distillation is handled
        by the memory agent so the write stays cheap.

        Args:
            user_id: The user's ID.
            observation: A JSON-serializable dict describing the signal, e.g.
                ``{"type": "task_completed", "hour": 10, "title": "..."}``.

        Returns:
            The updated UserMemory instance.
        """
        memory = await cls.get_memory(user_id)
        observations = list(memory.observations or [])
        observations.append(observation)
        # Keep only the most recent MAX_OBSERVATIONS entries.
        if len(observations) > cls.MAX_OBSERVATIONS:
            observations = observations[-cls.MAX_OBSERVATIONS :]
        memory.observations = observations
        await cls.save_memory(memory)
        return memory

    @classmethod
    async def clear_memory(cls, user_id: str) -> None:
        """Delete the user's memory document entirely ('forget everything').

        Args:
            user_id: The user's ID.
        """
        if not user_id:
            return
        db = get_db()
        await db.collection(cls.COLLECTION).document(user_id).delete()
