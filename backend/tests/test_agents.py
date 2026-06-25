"""Tests for all ChronAI agents.

Each test mocks Vertex AI and MCP tools to verify agent logic
without requiring real API keys or credentials.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestOrchestratorAgent:
    """Tests for the OrchestratorAgent."""

    @pytest.fixture(autouse=True)
    def setup_orchestrator(self, mock_vertexai_model, mock_mcp_client):
        """Set up the orchestrator agent with mocked dependencies."""
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        with patch("app.agents.orchestrator.vertexai.init"), \
             patch("app.agents.orchestrator.GenerativeModel", return_value=mock_vertexai_model):
            from app.agents.orchestrator import OrchestratorAgent

            self.agent = OrchestratorAgent(mcp_client=mock_mcp_client)
            self.mock_model = mock_vertexai_model
            yield
            AgentRegistry._agents.clear()

    async def test_orchestrator_direct_response(self):
        """Send a casual chat message, verify orchestrator returns direct_response."""
        # Configure model to return a direct response (no routing)
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "intent": "greeting",
                "agents": [],
                "tasks": [],
                "direct_response": "Hello! I'm ChronAI, your productivity companion.",
            })
        )

        result = await self.agent.execute({
            "message": "Hi there!",
            "auth_token": "test-token",
            "conversation_history": [],
        })

        assert result["content"] == "Hello! I'm ChronAI, your productivity companion."
        assert result["agent"] == "orchestrator"
        assert result["metadata"]["routed_to"] == []

    async def test_orchestrator_routes_to_planner(self, mock_mcp_client):
        """Send a task-related message, verify it routes to planner."""
        from app.agents.base import AgentRegistry

        # Set up a mock planner agent
        mock_planner = AsyncMock()
        mock_planner.execute = AsyncMock(return_value={
            "content": "I've created 3 tasks for your project.",
            "agent": "planner",
            "tasks": [],
        })
        AgentRegistry._agents["planner"] = mock_planner

        # Configure model to route to planner
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "intent": "task_creation",
                "agents": ["planner"],
                "tasks": [{"agent": "planner", "instruction": "Break down: build a website"}],
                "direct_response": None,
            })
        )

        result = await self.agent.execute({
            "message": "Help me plan building a website",
            "auth_token": "test-token",
            "conversation_history": [],
        })

        # Should have called the planner
        mock_planner.execute.assert_called_once()
        assert "tasks for your project" in result["content"]


class TestPlannerAgent:
    """Tests for the PlannerAgent."""

    @pytest.fixture(autouse=True)
    def setup_planner(self, mock_vertexai_model, mock_mcp_client):
        """Set up the planner agent with mocked dependencies."""
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        with patch("app.agents.planner.vertexai.init"), \
             patch("app.agents.planner.GenerativeModel", return_value=mock_vertexai_model):
            from app.agents.planner import PlannerAgent

            self.agent = PlannerAgent(mcp_client=mock_mcp_client)
            self.mock_model = mock_vertexai_model
            self.mock_mcp = mock_mcp_client
            yield
            AgentRegistry._agents.clear()

    async def test_planner_decompose_goal(self):
        """Test PlannerAgent.execute() with mocked Gemini returning a valid plan JSON."""
        plan_response = {
            "plan_summary": "Build a portfolio website",
            "tasks": [
                {
                    "title": "Design wireframes",
                    "notes": "Create low-fidelity wireframes",
                    "due_days_from_now": 3,
                    "priority": "high",
                },
                {
                    "title": "Set up hosting",
                    "notes": "Choose a hosting provider",
                    "due_days_from_now": 5,
                    "priority": "medium",
                },
            ],
            "response": "I've created a plan to build your portfolio website.",
        }
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps(plan_response)
        )

        # Mock MCP create_task to return a success
        self.mock_mcp.call_tool.return_value = {"id": "task123", "title": "Design wireframes"}

        result = await self.agent.execute({
            "message": "Help me build a portfolio website",
            "auth_token": "test-token",
            "user_id": "",
        })

        assert "portfolio website" in result["content"]
        assert len(result["tasks"]) == 2
        assert result["agent"] == "planner"


class TestSchedulerAgent:
    """Tests for the SchedulerAgent."""

    @pytest.fixture(autouse=True)
    def setup_scheduler(self, mock_vertexai_model, mock_mcp_client):
        """Set up the scheduler agent with mocked dependencies."""
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        with patch("app.agents.scheduler.vertexai.init"), \
             patch("app.agents.scheduler.GenerativeModel", return_value=mock_vertexai_model):
            from app.agents.scheduler import SchedulerAgent

            self.agent = SchedulerAgent(mcp_client=mock_mcp_client)
            self.mock_model = mock_vertexai_model
            self.mock_mcp = mock_mcp_client
            yield
            AgentRegistry._agents.clear()

    async def test_scheduler_find_slots(self):
        """Test SchedulerAgent.execute() with mocked Gemini."""
        schedule_response = {
            "action": "find_slots",
            "event_details": {"summary": "Team meeting", "duration_minutes": 60},
            "response": "Looking for a 1-hour slot for your team meeting.",
        }
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps(schedule_response)
        )

        # Mock MCP to return free slots
        self.mock_mcp.call_tool.return_value = [
            {"start": "2024-01-15T09:00:00", "end": "2024-01-15T10:00:00", "duration_minutes": 60}
        ]

        result = await self.agent.execute({
            "message": "Find time for a team meeting",
            "auth_token": "test-token",
        })

        assert "team meeting" in result["content"].lower()
        assert result["agent"] == "scheduler"
        assert result["action"] == "find_slots"


class TestNotificationAgent:
    """Tests for the NotificationAgent."""

    @pytest.fixture(autouse=True)
    def setup_notification(self, mock_vertexai_model, mock_mcp_client):
        """Set up the notification agent with mocked dependencies."""
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        with patch("app.agents.notification.vertexai.init"), \
             patch("app.agents.notification.GenerativeModel", return_value=mock_vertexai_model):
            from app.agents.notification import NotificationAgent

            self.agent = NotificationAgent(mcp_client=mock_mcp_client)
            self.mock_model = mock_vertexai_model
            yield
            AgentRegistry._agents.clear()

    async def test_notification_generate(self):
        """Test NotificationAgent.execute() with mocked Gemini."""
        notification_response = {
            "notifications": [
                {
                    "message": "Your project deadline is approaching!",
                    "urgency": "high",
                    "task_title": "Submit report",
                    "suggestion": "Consider starting the final review now.",
                }
            ],
            "response": "You have 1 urgent notification: Your project deadline is approaching!",
        }
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps(notification_response)
        )

        result = await self.agent.execute({
            "message": "Check my notifications",
            "auth_token": "test-token",
        })

        assert "urgent notification" in result["content"]
        assert result["agent"] == "notification"
        assert len(result["notifications"]) == 1
        assert result["notifications"][0]["urgency"] == "high"


class TestEmailAgent:
    """Tests for the EmailAgent."""

    @pytest.fixture(autouse=True)
    def setup_email(self, mock_vertexai_model, mock_mcp_client):
        """Set up the email agent with mocked dependencies."""
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        with patch("app.agents.email.vertexai.init"), \
             patch("app.agents.email.GenerativeModel", return_value=mock_vertexai_model):
            from app.agents.email import EmailAgent

            self.agent = EmailAgent(mcp_client=mock_mcp_client)
            self.mock_model = mock_vertexai_model
            self.mock_mcp = mock_mcp_client
            yield
            AgentRegistry._agents.clear()

    async def test_email_agent_draft(self):
        """Test EmailAgent.execute() with mocked Gemini and MCP."""
        action_response = {
            "action": "draft_email",
            "parameters": {
                "to": "colleague@example.com",
                "subject": "Meeting Follow-up",
                "body": "Hi, just following up on our meeting today...",
            },
            "response": "I've drafted a follow-up email to your colleague.",
        }
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps(action_response)
        )

        # Mock MCP draft creation
        self.mock_mcp.call_tool.return_value = {
            "id": "draft123",
            "message_id": "msg123",
            "status": "draft_created",
        }

        result = await self.agent.execute({
            "message": "Draft a follow-up email to my colleague about today's meeting",
            "auth_token": "test-token",
        })

        assert "drafted" in result["content"].lower()
        assert result["agent"] == "email"
        assert result["action"] == "draft_email"
        self.mock_mcp.call_tool.assert_called_once()


class TestVoiceAgent:
    """Tests for the VoiceAgent."""

    @pytest.fixture(autouse=True)
    def setup_voice(self, mock_mcp_client):
        """Set up the voice agent."""
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        from app.agents.voice import VoiceAgent

        self.agent = VoiceAgent(mcp_client=mock_mcp_client)
        yield
        AgentRegistry._agents.clear()

    async def test_voice_agent_synthesize(self):
        """Test VoiceAgent.execute() with mocked httpx response."""
        fake_audio = "SGVsbG8gV29ybGQ="  # base64 encoded "Hello World"

        with patch("httpx.AsyncClient") as mock_httpx_cls:
            mock_client_instance = AsyncMock()
            mock_httpx_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_httpx_cls.return_value.__aexit__ = AsyncMock(return_value=None)

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_response.json.return_value = {"audioContent": fake_audio}
            mock_client_instance.post.return_value = mock_response

            result = await self.agent.execute({
                "message": "Hello, how are you?",
            })

        assert result["content"] == fake_audio
        assert result["agent"] == "voice"
        assert result["audio_format"] == "mp3"

    async def test_voice_agent_empty_text(self):
        """Test VoiceAgent returns empty content for empty text."""
        result = await self.agent.execute({"message": ""})

        assert result["content"] == ""
        assert result.get("error") == "No text provided for synthesis"
