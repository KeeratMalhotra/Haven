"""Tests for the Sprint 11 persistent memory & learning module.

All tests rely on the autouse ``mock_firestore`` fixture (in-memory Firestore)
from conftest, so no real Firestore or Gemini access is required.
"""

import pytest

from app.agents import memory as mem
from app.agents.memory import (
    get_memory_context,
    memory_planning_hints,
    record_observation,
)
from app.db.models import UserMemory
from app.db.repositories import MemoryRepository


class TestMemoryRepository:
    """CRUD behaviour for the per-user memory document."""

    async def test_get_memory_missing_returns_empty(self):
        """A user with no memory yet gets a fresh, empty UserMemory (not None)."""
        memory = await MemoryRepository.get_memory("ghost")
        assert isinstance(memory, UserMemory)
        assert memory.user_id == "ghost"
        assert memory.observations == []

    async def test_record_observation_appends_and_caps(self):
        """Observations accumulate and are capped at MAX_OBSERVATIONS."""
        for i in range(MemoryRepository.MAX_OBSERVATIONS + 25):
            await MemoryRepository.record_observation(
                "u1", {"type": "task_created", "hour": 9, "title": f"t{i}"}
            )
        memory = await MemoryRepository.get_memory("u1")
        assert len(memory.observations) == MemoryRepository.MAX_OBSERVATIONS

    async def test_clear_memory(self):
        """Clearing removes the document entirely."""
        await MemoryRepository.record_observation(
            "u2", {"type": "task_created", "hour": 9, "title": "x"}
        )
        await MemoryRepository.clear_memory("u2")
        memory = await MemoryRepository.get_memory("u2")
        assert memory.observations == []


class TestDeterministicLearning:
    """The deterministic distillation must produce real, accurate stats."""

    async def test_productive_hours_and_stats(self):
        """Completions + focus sessions drive productive hours and stats."""
        for h in (9, 9, 10, 10, 11):
            await record_observation(
                "learner",
                "task_completed",
                {"hour": h, "title": "finish report",
                 "estimated_minutes": 60, "actual_minutes": 60},
            )
        for _ in range(4):
            await record_observation(
                "learner", "task_created", {"hour": 9, "title": "finish report"}
            )

        memory = await MemoryRepository.get_memory("learner")
        # 9 and 10 are the most common completion hours.
        assert 9 in memory.productive_hours
        assert 10 in memory.productive_hours
        stats = memory.behavioral_stats
        assert stats.tasks_completed == 5
        assert stats.tasks_created == 4
        # Perfect estimates -> high accuracy.
        assert stats.estimate_accuracy == 1.0
        assert stats.estimate_samples == 5

    async def test_avoided_hours_from_reschedules(self):
        """Repeatedly rescheduling away from an hour marks it avoided."""
        for _ in range(2):
            await record_observation(
                "resched",
                "task_rescheduled",
                {"title": "gym", "from_hour": 19, "to_hour": 7},
            )
        memory = await MemoryRepository.get_memory("resched")
        assert 19 in memory.avoided_hours
        # Frequently-rescheduled item surfaces as a pattern.
        assert any("gym" in p for p in memory.task_patterns)

    async def test_computed_insights_have_stable_ids(self):
        """Recomputing replaces computed insights instead of duplicating them."""
        for _ in range(2):
            for h in (9, 10):
                await record_observation(
                    "stable", "task_completed", {"hour": h, "title": "deep work"}
                )
        memory = await MemoryRepository.get_memory("stable")
        ids = [i.id for i in memory.insights]
        assert len(ids) == len(set(ids))  # no duplicates
        assert any(i.id == "computed:productive_hours" for i in memory.insights)


class TestMemoryContextAndHints:
    """Memory must serve usable context + planning hints to the agents."""

    async def test_get_memory_context_empty_for_new_user(self):
        """Brand-new users contribute no memory context (keeps prompts clean)."""
        ctx = await get_memory_context("nobody")
        assert ctx == ""

    async def test_get_memory_context_includes_productive_window(self):
        """Once learned, the context string mentions the productive window."""
        for h in (9, 10, 9, 10, 11):
            await record_observation(
                "ctx", "task_completed", {"hour": h, "title": "work"}
            )
        ctx = await get_memory_context("ctx")
        assert "Most productive" in ctx

    async def test_planning_hints_flag_poor_estimates(self):
        """Poor estimate accuracy should set pad_focus_estimates."""
        for _ in range(3):
            await record_observation(
                "pad",
                "task_completed",
                {"hour": 9, "title": "t", "estimated_minutes": 30, "actual_minutes": 90},
            )
        memory = await MemoryRepository.get_memory("pad")
        hints = memory_planning_hints(memory)
        assert hints["pad_focus_estimates"] is True


class TestObservationNormalization:
    """Observation normalization bounds untrusted input."""

    def test_invalid_hour_falls_back(self):
        obs = mem._normalize_observation("task_completed", {"hour": 99}, None)
        # Out-of-range hour is rejected; falls back to a valid 0-23 hour.
        assert 0 <= obs["hour"] <= 23

    def test_title_is_length_capped(self):
        obs = mem._normalize_observation(
            "task_created", {"title": "x" * 500}, None
        )
        assert len(obs["title"]) <= 120
