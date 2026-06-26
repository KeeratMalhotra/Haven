"""Tests for the daily briefing agent and API endpoint."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.briefing import generate_daily_briefing
from app.db.models import User, UserProfile
from app.db.repositories import UserRepository


@pytest.mark.asyncio
async def test_generate_daily_briefing_returns_string(mock_firestore, mock_vertexai_model):
    """generate_daily_briefing should return a string."""
    # Create a user with a profile
    user = User(
        id="user123",
        email="test@example.com",
        name="Test User",
        profile=UserProfile(
            role="professional",
            occupation="software engineer",
            priorities=["coding"],
            goals=["ship product"],
            onboarding_complete=True,
        ),
    )
    await UserRepository.create(user)

    # Mock the model response for briefing
    mock_vertexai_model.generate_content.return_value = MagicMock(
        text="Good morning, Test User! Here is your briefing for today."
    )

    mock_mcp = AsyncMock()
    mock_mcp.call_tool = AsyncMock(return_value=[])

    result = await generate_daily_briefing("user123", "test-token", mock_mcp)
    assert isinstance(result, str)
    assert len(result) > 0
    assert "Good morning" in result


@pytest.mark.asyncio
async def test_generate_daily_briefing_no_user(mock_firestore, mock_vertexai_model):
    """Briefing should still work even without a user profile."""
    mock_vertexai_model.generate_content.return_value = MagicMock(
        text="Good morning! Here is your briefing for today."
    )

    mock_mcp = AsyncMock()
    mock_mcp.call_tool = AsyncMock(return_value=[])

    result = await generate_daily_briefing("nonexistent", "test-token", mock_mcp)
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_generate_daily_briefing_mcp_failure(mock_firestore, mock_vertexai_model):
    """Briefing should handle MCP call failures gracefully."""
    user = User(
        id="user123",
        email="test@example.com",
        name="Test User",
        profile=UserProfile(onboarding_complete=True),
    )
    await UserRepository.create(user)

    mock_vertexai_model.generate_content.return_value = MagicMock(
        text="Good morning! I could not fetch your schedule but I am here to help."
    )

    mock_mcp = AsyncMock()
    mock_mcp.call_tool = AsyncMock(side_effect=Exception("MCP error"))

    result = await generate_daily_briefing("user123", "test-token", mock_mcp)
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_generate_daily_briefing_gemini_failure(mock_firestore, mock_vertexai_model):
    """Briefing should return a fallback message if Gemini fails."""
    user = User(
        id="user123",
        email="test@example.com",
        name="Test User",
        profile=UserProfile(onboarding_complete=True),
    )
    await UserRepository.create(user)

    mock_vertexai_model.generate_content.side_effect = Exception("Gemini unavailable")

    mock_mcp = AsyncMock()
    mock_mcp.call_tool = AsyncMock(return_value=[])

    result = await generate_daily_briefing("user123", "test-token", mock_mcp)
    assert isinstance(result, str)
    assert "Test User" in result
    assert "here to help" in result


@pytest.mark.asyncio
async def test_briefing_api_endpoint(app_client, mock_firestore, mock_vertexai_model):
    """GET /api/briefing should return a briefing string."""
    # Create user with profile
    user = User(
        id="user123",
        email="test@example.com",
        name="Test User",
        profile=UserProfile(
            role="student",
            occupation="CS major",
            onboarding_complete=True,
        ),
    )
    await UserRepository.create(user)

    mock_vertexai_model.generate_content.return_value = MagicMock(
        text="Good morning! Ready for a productive day."
    )

    response = await app_client.get(
        "/api/briefing", params={"auth_token": "test-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "briefing" in data
    assert isinstance(data["briefing"], str)
    assert len(data["briefing"]) > 0


@pytest.mark.asyncio
async def test_briefing_api_requires_auth(app_client):
    """GET /api/briefing should require authentication."""
    response = await app_client.get("/api/briefing")
    assert response.status_code == 401
