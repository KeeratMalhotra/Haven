"""Tests for the server-side Speech-to-Text (STT) endpoint.

These verify the /api/voice/transcribe endpoint's request handling and its
parsing of the Google Cloud Speech-to-Text response, without making real
network calls (the httpx client is mocked).
"""

import base64
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _fake_httpx_client(json_payload: dict, status_code: int = 200):
    """Build a patch target mimicking httpx.AsyncClient as a context manager."""
    response = MagicMock()
    response.json = MagicMock(return_value=json_payload)
    response.status_code = status_code
    response.raise_for_status = MagicMock()

    client = MagicMock()
    client.post = AsyncMock(return_value=response)

    @asynccontextmanager
    async def _cm(*args, **kwargs):
        yield client

    return _cm, client


@pytest.mark.asyncio
async def test_transcribe_returns_transcript(app_client, monkeypatch):
    """A successful STT call returns the joined transcript and confidence."""
    monkeypatch.setattr("app.api.voice.settings.GCP_API_KEY", "test-key")

    payload = {
        "results": [
            {"alternatives": [{"transcript": "hello there", "confidence": 0.95}]},
            {"alternatives": [{"transcript": "how are you", "confidence": 0.9}]},
        ]
    }
    cm, client = _fake_httpx_client(payload)

    with patch("app.api.voice.httpx.AsyncClient", cm):
        audio = base64.b64encode(b"fake-audio-bytes").decode()
        res = await app_client.post(
            "/api/voice/transcribe",
            json={"audio_base64": audio, "encoding": "WEBM_OPUS"},
        )

    assert res.status_code == 200
    data = res.json()
    assert data["transcript"] == "hello there how are you"
    assert data["confidence"] == pytest.approx(0.95)

    # Verify the outbound request used the configured API key and audio.
    _, kwargs = client.post.call_args
    assert kwargs["params"] == {"key": "test-key"}
    assert kwargs["json"]["audio"]["content"] == audio
    assert kwargs["json"]["config"]["encoding"] == "WEBM_OPUS"


@pytest.mark.asyncio
async def test_transcribe_empty_audio_returns_400(app_client, monkeypatch):
    """Missing audio is rejected before any network call."""
    monkeypatch.setattr("app.api.voice.settings.GCP_API_KEY", "test-key")
    res = await app_client.post(
        "/api/voice/transcribe", json={"audio_base64": ""}
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_transcribe_without_api_key_returns_503(app_client, monkeypatch):
    """When GCP_API_KEY is unset, the endpoint reports the service unavailable."""
    monkeypatch.setattr("app.api.voice.settings.GCP_API_KEY", "")
    audio = base64.b64encode(b"x").decode()
    res = await app_client.post(
        "/api/voice/transcribe", json={"audio_base64": audio}
    )
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_transcribe_no_speech_returns_empty(app_client, monkeypatch):
    """An empty results list yields an empty transcript (not an error)."""
    monkeypatch.setattr("app.api.voice.settings.GCP_API_KEY", "test-key")
    cm, _ = _fake_httpx_client({"results": []})
    with patch("app.api.voice.httpx.AsyncClient", cm):
        audio = base64.b64encode(b"silence").decode()
        res = await app_client.post(
            "/api/voice/transcribe", json={"audio_base64": audio}
        )
    assert res.status_code == 200
    assert res.json()["transcript"] == ""


@pytest.mark.asyncio
async def test_transcribe_omits_sample_rate_when_zero(app_client, monkeypatch):
    """sampleRateHertz is left out for WEBM_OPUS unless explicitly provided."""
    monkeypatch.setattr("app.api.voice.settings.GCP_API_KEY", "test-key")
    cm, client = _fake_httpx_client(
        {"results": [{"alternatives": [{"transcript": "hi", "confidence": 0.8}]}]}
    )
    with patch("app.api.voice.httpx.AsyncClient", cm):
        audio = base64.b64encode(b"a").decode()
        await app_client.post(
            "/api/voice/transcribe",
            json={"audio_base64": audio, "sample_rate": 0},
        )
    _, kwargs = client.post.call_args
    assert "sampleRateHertz" not in kwargs["json"]["config"]
