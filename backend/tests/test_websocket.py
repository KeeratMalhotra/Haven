"""Tests for WebSocket endpoint.

Uses FastAPI TestClient with WebSocket context manager for testing
the /ws endpoint, including message flow and error handling.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def test_client():
    """Create a TestClient for WebSocket testing with mocked lifespan."""
    from contextlib import asynccontextmanager

    from app.agents.base import AgentRegistry

    AgentRegistry._agents.clear()

    @asynccontextmanager
    async def test_lifespan(app):
        yield

    from app import main as app_module

    original_lifespan = app_module.app.router.lifespan_context
    app_module.app.router.lifespan_context = test_lifespan

    client = TestClient(app_module.app)
    yield client

    app_module.app.router.lifespan_context = original_lifespan
    AgentRegistry._agents.clear()


class TestWebSocket:
    """Tests for the /ws WebSocket endpoint."""

    def test_websocket_connect_and_receive(self, test_client):
        """Connect to /ws, send a chat message, receive a text response."""
        from app.agents.base import AgentRegistry

        # Register a mock orchestrator with execute_streaming
        mock_orchestrator = MagicMock()
        mock_orchestrator.name = "orchestrator"

        async def mock_execute_streaming(task, send_chunk, status_callback=None):
            return {
                "content": "Hello! How can I help you?",
                "agent": "orchestrator",
                "metadata": {"intent": "greeting", "routed_to": []},
                "pending_action": None,
                "_streamed": False,
            }

        mock_orchestrator.execute_streaming = mock_execute_streaming
        AgentRegistry._agents["orchestrator"] = mock_orchestrator

        with test_client.websocket_connect("/ws") as ws:
            ws.send_text(json.dumps({
                "type": "chat",
                "content": "Hello!",
                "auth_token": "test-token-123",
            }))
            data = ws.receive_json()

            assert data["type"] == "text"
            assert data["content"] == "Hello! How can I help you?"
            assert data["agent"] == "orchestrator"

    def test_websocket_invalid_message(self, test_client):
        """Send invalid JSON, receive error message."""
        with test_client.websocket_connect("/ws") as ws:
            ws.send_text("this is not valid json{{{")
            data = ws.receive_json()

            assert data["type"] == "text"
            assert "Invalid message format" in data["content"]
            assert data["agent"] == "system"

    def test_websocket_no_orchestrator(self, test_client):
        """Send a message when no orchestrator is registered, receive system message."""
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        with test_client.websocket_connect("/ws") as ws:
            ws.send_text(json.dumps({
                "type": "chat",
                "content": "Hello!",
                "auth_token": "test-token-123",
            }))
            data = ws.receive_json()

            assert data["type"] == "text"
            assert "starting up" in data["content"].lower()
            assert data["agent"] == "system"

    def test_websocket_auth_failure(self, test_client):
        """Send message with invalid auth token, receive auth error."""
        from fastapi import HTTPException, status

        from app.agents.base import AgentRegistry

        # Register a mock orchestrator (needed so auth check happens first)
        mock_orchestrator = AsyncMock()
        mock_orchestrator.name = "orchestrator"
        mock_orchestrator.execute = AsyncMock(return_value={
            "content": "response",
            "agent": "orchestrator",
            "metadata": {"intent": "test", "routed_to": []},
        })
        AgentRegistry._agents["orchestrator"] = mock_orchestrator

        # Make verify_google_token raise an HTTP exception
        # Patch on the module where it is imported (app.main)
        with patch(
            "app.main.verify_google_token",
            new_callable=AsyncMock,
            side_effect=HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            ),
        ):
            with test_client.websocket_connect("/ws") as ws:
                ws.send_text(json.dumps({
                    "type": "chat",
                    "content": "Hello!",
                    "auth_token": "invalid-token",
                }))
                data = ws.receive_json()

                assert "authentication failed" in data["content"].lower() or "sign in" in data["content"].lower()

    def test_websocket_streaming_chunks(self, test_client):
        """Verify execute_streaming sends text_chunk and text_end frames."""
        from app.agents.base import AgentRegistry

        # Create a mock orchestrator with execute_streaming
        mock_orchestrator = MagicMock()
        mock_orchestrator.name = "orchestrator"

        async def mock_execute_streaming(task, send_chunk, status_callback=None):
            # Simulate streaming by sending chunks
            await send_chunk("Hello ")
            await send_chunk("world!")
            return {
                "content": "Hello world!",
                "agent": "orchestrator",
                "metadata": {"intent": "greeting", "routed_to": ["scheduler"]},
                "pending_action": None,
                "_streamed": True,
            }

        mock_orchestrator.execute_streaming = mock_execute_streaming
        # Also provide hasattr support
        AgentRegistry._agents["orchestrator"] = mock_orchestrator

        with test_client.websocket_connect("/ws") as ws:
            ws.send_text(json.dumps({
                "type": "chat",
                "content": "What's on my calendar?",
                "auth_token": "test-token-123",
            }))

            # Should receive text_chunk frames first
            chunk1 = ws.receive_json()
            assert chunk1["type"] == "text_chunk"
            assert chunk1["content"] == "Hello "
            assert "message_id" in chunk1

            message_id = chunk1["message_id"]

            chunk2 = ws.receive_json()
            assert chunk2["type"] == "text_chunk"
            assert chunk2["content"] == "world!"
            assert chunk2["message_id"] == message_id

            # Should receive text_end frame last
            end_frame = ws.receive_json()
            assert end_frame["type"] == "text_end"
            assert end_frame["message_id"] == message_id

    def test_websocket_streaming_non_streamed_fallback(self, test_client):
        """Verify execute_streaming falls back to regular text frame when not streamed."""
        from app.agents.base import AgentRegistry

        # Create a mock orchestrator with execute_streaming that returns non-streamed
        mock_orchestrator = MagicMock()
        mock_orchestrator.name = "orchestrator"

        async def mock_execute_streaming(task, send_chunk, status_callback=None):
            # Simulate a direct_response (no streaming)
            return {
                "content": "Hey! I'm Haven.",
                "agent": "orchestrator",
                "metadata": {"intent": "greeting", "routed_to": []},
                "pending_action": None,
                "_streamed": False,
            }

        mock_orchestrator.execute_streaming = mock_execute_streaming
        AgentRegistry._agents["orchestrator"] = mock_orchestrator

        with test_client.websocket_connect("/ws") as ws:
            ws.send_text(json.dumps({
                "type": "chat",
                "content": "Hello!",
                "auth_token": "test-token-123",
            }))

            # Should receive a regular text frame (not chunk)
            data = ws.receive_json()
            assert data["type"] == "text"
            assert data["content"] == "Hey! I'm Haven."
            assert data["agent"] == "orchestrator"
