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

    async def test_planner_read_intent_lists_not_creates(self):
        """CRITICAL: a READ request must call list_tasks and NEVER create tasks."""
        # Gemini classifies the request as a read.
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "action": "list_tasks",
                "tasks": [],
                "response": "Let me pull up your tasks.",
            })
        )
        # MCP list_tasks returns the user's existing tasks.
        self.mock_mcp.call_tool.return_value = [
            {"id": "1", "title": "Buy groceries", "completed": False, "due": "2024-01-15T00:00:00.000Z"},
            {"id": "2", "title": "Submit report", "completed": True, "due": ""},
        ]

        result = await self.agent.execute({
            "message": "what tasks do I have today?",
            "auth_token": "test-token",
            "user_id": "",
        })

        # It must have read, not created.
        assert result["action"] == "list_tasks"
        self.mock_mcp.call_tool.assert_called_once()
        called_args = self.mock_mcp.call_tool.call_args[0]
        assert called_args[1] == "list_tasks"
        # Content shows the existing tasks in a friendly list.
        assert "Buy groceries" in result["content"]
        assert "Submit report" in result["content"]

    async def test_planner_read_empty_state(self):
        """A READ request with no tasks returns a friendly empty-state message."""
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "action": "list_tasks",
                "tasks": [],
                "response": "Let me check.",
            })
        )
        self.mock_mcp.call_tool.return_value = []

        result = await self.agent.execute({
            "message": "show my tasks",
            "auth_token": "test-token",
            "user_id": "",
        })

        assert result["action"] == "list_tasks"
        assert "no tasks" in result["content"].lower()


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

    async def test_scheduler_create_event_with_start_time(self):
        """Test that create_event passes start_time to MCP tool."""
        schedule_response = {
            "action": "create_event",
            "event_details": {
                "summary": "Meeting",
                "start_time": "today 18:00",
                "duration_minutes": 60,
            },
            "response": "Creating your meeting.",
        }
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps(schedule_response)
        )

        # Mock MCP create_event to return a successful result
        from datetime import datetime
        today = datetime.now()
        start_iso = today.replace(hour=18, minute=0, second=0, microsecond=0).isoformat()
        self.mock_mcp.call_tool.return_value = {
            "id": "event123",
            "summary": "Meeting",
            "start": start_iso,
            "end": "",
            "link": "https://calendar.google.com/event/123",
        }

        result = await self.agent.execute({
            "message": "Create event: meeting, today at 6pm",
            "auth_token": "test-token",
        })

        assert result["action"] == "create_event"
        assert "Meeting" in result["content"]
        assert "Done" in result["content"]
        # No clarification needed -> nothing pending.
        assert result.get("pending_action") is None

        # The scheduler runs a conflict check (list_events) then create_event.
        create_calls = [
            c for c in self.mock_mcp.call_tool.call_args_list
            if c[0][1] == "create_event"
        ]
        assert len(create_calls) == 1
        call_args = create_calls[0][0]
        assert call_args[0] == "google-calendar"
        assert call_args[1] == "create_event"
        tool_arguments = call_args[2]
        assert "start_time" in tool_arguments
        assert "18:00:00" in tool_arguments["start_time"]

    async def test_scheduler_resolve_start_time_today(self):
        """Test _resolve_start_time with 'today HH:MM' format (IST-grounded)."""
        from app.agents.scheduler import SchedulerAgent
        from app.utils.timectx import now_ist
        from datetime import datetime

        result = SchedulerAgent._resolve_start_time("today 18:00")
        dt = datetime.fromisoformat(result)
        assert dt.hour == 18
        assert dt.minute == 0
        assert dt.date() == now_ist().date()

    async def test_scheduler_resolve_start_time_tomorrow(self):
        """Test _resolve_start_time with 'tomorrow HH:MM' format (IST-grounded)."""
        from app.agents.scheduler import SchedulerAgent
        from app.utils.timectx import now_ist
        from datetime import datetime, timedelta

        result = SchedulerAgent._resolve_start_time("tomorrow 15:00")
        dt = datetime.fromisoformat(result)
        assert dt.hour == 15
        assert dt.minute == 0
        assert dt.date() == (now_ist() + timedelta(days=1)).date()

    async def test_scheduler_resolve_start_time_iso_passthrough(self):
        """Test _resolve_start_time passes through ISO format."""
        from app.agents.scheduler import SchedulerAgent

        iso_str = "2024-06-15T09:00:00"
        result = SchedulerAgent._resolve_start_time(iso_str)
        assert result == iso_str

    async def test_scheduler_resolve_start_time_fallback(self):
        """Test _resolve_start_time defaults to next hour on unparseable input."""
        from app.agents.scheduler import SchedulerAgent
        from app.utils.timectx import now_ist
        from datetime import datetime

        result = SchedulerAgent._resolve_start_time("some random text")
        dt = datetime.fromisoformat(result)
        # Should be a timezone-aware IST datetime in the future (next hour).
        assert dt > now_ist()


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


class TestGenerateHelper:
    """Tests for the shared AgentBase.generate() timeout/fallback helper."""

    @pytest.fixture(autouse=True)
    def setup_agent(self, mock_mcp_client):
        from app.agents.base import AgentRegistry, AgentBase

        AgentRegistry._agents.clear()

        class _DummyAgent(AgentBase):
            name = "dummy"

            async def execute(self, task: dict) -> dict:
                return {"content": "", "agent": self.name}

        self.agent = _DummyAgent(mcp_client=mock_mcp_client)
        yield
        AgentRegistry._agents.clear()

    async def test_generate_returns_text_on_success(self):
        self.agent.model = MagicMock()
        self.agent.model.generate_content = MagicMock(return_value=MagicMock(text="hello"))

        result = await self.agent.generate("prompt", fallback="FALLBACK")

        assert result == "hello"

    async def test_generate_returns_fallback_on_error(self):
        self.agent.model = MagicMock()
        self.agent.model.generate_content = MagicMock(side_effect=RuntimeError("boom"))

        result = await self.agent.generate("prompt", fallback="FALLBACK")

        assert result == "FALLBACK"

    async def test_generate_returns_fallback_on_timeout(self):
        import time

        self.agent.model = MagicMock()
        # Blocking call that exceeds the (tiny) timeout we pass in.
        self.agent.model.generate_content = MagicMock(
            side_effect=lambda *a, **k: time.sleep(1.0)
        )

        result = await self.agent.generate("prompt", fallback="FALLBACK", timeout=0.05)

        assert result == "FALLBACK"

    async def test_generate_returns_fallback_when_no_model(self):
        self.agent.model = None
        result = await self.agent.generate("prompt", fallback="FALLBACK")
        assert result == "FALLBACK"


class TestOrchestratorStatusCallback:
    """Tests for the orchestrator's real-time status callback."""

    @pytest.fixture(autouse=True)
    def setup_orchestrator(self, mock_vertexai_model, mock_mcp_client):
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        with patch("app.agents.orchestrator.vertexai.init"), \
             patch("app.agents.orchestrator.GenerativeModel", return_value=mock_vertexai_model):
            from app.agents.orchestrator import OrchestratorAgent

            self.agent = OrchestratorAgent(mcp_client=mock_mcp_client)
            self.mock_model = mock_vertexai_model
            yield
            AgentRegistry._agents.clear()

    async def test_status_callback_emitted_before_agent(self):
        from app.agents.base import AgentRegistry

        mock_scheduler = AsyncMock()
        mock_scheduler.execute = AsyncMock(return_value={
            "content": "Your calendar is clear this week!",
            "agent": "scheduler",
        })
        AgentRegistry._agents["scheduler"] = mock_scheduler

        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "intent": "calendar_query",
                "agents": ["scheduler"],
                "tasks": [{"agent": "scheduler", "instruction": "List events"}],
                "direct_response": None,
            })
        )

        statuses = []

        async def status_callback(payload):
            statuses.append(payload)

        result = await self.agent.execute(
            {
                "message": "what's on my calendar?",
                "auth_token": "test-token",
                "conversation_history": [],
            },
            status_callback=status_callback,
        )

        # A status update was emitted for the scheduler before its work.
        assert len(statuses) == 1
        assert statuses[0]["type"] == "status"
        assert statuses[0]["agent"] == "scheduler"
        assert statuses[0]["content"]  # non-empty friendly text
        # Single agent -> returned verbatim (no consolidation Gemini call).
        assert result["content"] == "Your calendar is clear this week!"
