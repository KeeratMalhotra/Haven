"""Tests for the user_context utility."""

import pytest

from app.utils.user_context import get_user_context
from app.db.repositories import UserRepository
from app.db.models import User, UserProfile


@pytest.mark.asyncio
async def test_get_user_context_no_user(mock_firestore):
    """Should return 'not completed' message when user does not exist."""
    result = await get_user_context("nonexistent_user")
    assert result.startswith("User has not completed onboarding.")
    # Service connection status is still surfaced pre-onboarding so agents
    # can guide the user (mandatory services are granted at sign-in).
    assert "Connected Services:" in result


@pytest.mark.asyncio
async def test_get_user_context_empty_user_id(mock_firestore):
    """Should return 'not completed' message for empty user_id."""
    result = await get_user_context("")
    assert result == "User has not completed onboarding."


@pytest.mark.asyncio
async def test_get_user_context_incomplete_onboarding(mock_firestore):
    """Should return 'not completed' when onboarding_complete is False."""
    user = User(
        id="user123",
        email="test@example.com",
        name="Test User",
        profile=UserProfile(role="student", onboarding_complete=False),
    )
    await UserRepository.create(user)

    result = await get_user_context("user123")
    assert result.startswith("User has not completed onboarding.")
    assert "Connected Services:" in result


@pytest.mark.asyncio
async def test_get_user_context_complete_profile(mock_firestore):
    """Should return formatted context string when profile is complete."""
    user = User(
        id="user123",
        email="test@example.com",
        name="Test User",
        profile=UserProfile(
            role="professional",
            occupation="software engineer",
            work_hours_start=9,
            work_hours_end=18,
            wake_time=7,
            sleep_time=23,
            priorities=["coding", "health"],
            daily_routine="Morning workout, then coding",
            goals=["ship product", "learn rust"],
            onboarding_complete=True,
        ),
    )
    await UserRepository.create(user)

    result = await get_user_context("user123")
    assert "User Profile:" in result
    assert "Role: professional" in result
    assert "Occupation: software engineer" in result
    assert "Work hours: 9:00 - 18:00" in result
    assert "Wake time: 7:00, Sleep time: 23:00" in result
    assert "coding" in result
    assert "health" in result
    assert "ship product" in result
    assert "learn rust" in result
    assert "Morning workout" in result
