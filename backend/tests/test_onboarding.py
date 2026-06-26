"""Tests for the onboarding API endpoints."""

import pytest


@pytest.mark.asyncio
async def test_post_onboarding_saves_profile(app_client, mock_firestore):
    """POST /api/onboarding should save profile fields and mark onboarding complete."""
    payload = {
        "role": "professional",
        "occupation": "software engineer",
        "work_hours_start": 9,
        "work_hours_end": 17,
        "wake_time": 7,
        "sleep_time": 23,
        "priorities": ["coding", "health"],
        "daily_routine": "Morning workout, then coding",
        "goals": ["ship product", "learn rust"],
    }
    response = await app_client.post(
        "/api/onboarding", json=payload, params={"auth_token": "test-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"

    # Verify profile was saved in Firestore mock
    users_collection = mock_firestore._data.get("users", {})
    assert "user123" in users_collection
    stored_profile = users_collection["user123"]["profile"]
    assert stored_profile["role"] == "professional"
    assert stored_profile["occupation"] == "software engineer"
    assert stored_profile["onboarding_complete"] is True
    assert stored_profile["priorities"] == ["coding", "health"]
    assert stored_profile["goals"] == ["ship product", "learn rust"]


@pytest.mark.asyncio
async def test_post_onboarding_creates_user_if_not_exists(app_client, mock_firestore):
    """POST /api/onboarding should create user document if it does not exist."""
    payload = {"role": "student", "occupation": "CS major"}
    response = await app_client.post(
        "/api/onboarding", json=payload, params={"auth_token": "test-token"}
    )
    assert response.status_code == 200

    users_collection = mock_firestore._data.get("users", {})
    assert "user123" in users_collection
    assert users_collection["user123"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_onboarding_status_incomplete(app_client, mock_firestore):
    """GET /api/onboarding/status should return complete: false when no profile."""
    response = await app_client.get(
        "/api/onboarding/status", params={"auth_token": "test-token"}
    )
    assert response.status_code == 200
    assert response.json() == {"complete": False}


@pytest.mark.asyncio
async def test_onboarding_status_complete(app_client, mock_firestore):
    """GET /api/onboarding/status should return complete: true after onboarding."""
    # First complete onboarding
    payload = {"role": "freelancer", "occupation": "designer"}
    await app_client.post(
        "/api/onboarding", json=payload, params={"auth_token": "test-token"}
    )

    response = await app_client.get(
        "/api/onboarding/status", params={"auth_token": "test-token"}
    )
    assert response.status_code == 200
    assert response.json() == {"complete": True}


@pytest.mark.asyncio
async def test_get_profile_default(app_client, mock_firestore):
    """GET /api/profile should return default profile when user has no profile."""
    response = await app_client.get(
        "/api/profile", params={"auth_token": "test-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "profile" in data
    assert data["profile"]["onboarding_complete"] is False
    assert data["profile"]["role"] == ""


@pytest.mark.asyncio
async def test_get_profile_after_onboarding(app_client, mock_firestore):
    """GET /api/profile should return full profile after onboarding."""
    payload = {
        "role": "entrepreneur",
        "occupation": "startup founder",
        "priorities": ["fundraising", "hiring"],
        "goals": ["Series A"],
    }
    await app_client.post(
        "/api/onboarding", json=payload, params={"auth_token": "test-token"}
    )

    response = await app_client.get(
        "/api/profile", params={"auth_token": "test-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["role"] == "entrepreneur"
    assert data["profile"]["occupation"] == "startup founder"
    assert data["profile"]["onboarding_complete"] is True
    assert "fundraising" in data["profile"]["priorities"]


@pytest.mark.asyncio
async def test_onboarding_requires_auth(app_client):
    """API endpoints should require auth token."""
    response = await app_client.post("/api/onboarding", json={"role": "student"})
    assert response.status_code == 401

    response = await app_client.get("/api/onboarding/status")
    assert response.status_code == 401

    response = await app_client.get("/api/profile")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_onboarding_accepts_authorization_header(app_client, mock_firestore):
    """POST /api/onboarding should accept Authorization header."""
    payload = {"role": "student"}
    response = await app_client.post(
        "/api/onboarding",
        json=payload,
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
