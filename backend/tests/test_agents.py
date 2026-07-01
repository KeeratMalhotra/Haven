"""Tests for all Haven agents.

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
                "direct_response": "Hello! I'm Haven, your productivity companion.",
            })
        )

        result = await self.agent.execute({
            "message": "Hi there!",
            "auth_token": "test-token",
            "conversation_history": [],
        })

        assert result["content"] == "Hello! I'm Haven, your productivity companion."
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

    async def test_generate_uses_contextvar_callback(self):
        """When the contextvar is set, generate() uses streaming mode automatically."""
        from app.agents.base import _stream_callback_var

        chunks_received = []

        async def _test_callback(text: str) -> None:
            chunks_received.append(text)

        # Set up a mock model that supports streaming
        mock_response_iter = MagicMock()
        chunk1 = MagicMock()
        chunk1.text = "Hello "
        chunk2 = MagicMock()
        chunk2.text = "world!"
        mock_response_iter.__iter__ = MagicMock(return_value=iter([chunk1, chunk2]))

        self.agent.model = MagicMock()
        # First call with stream=True returns the iterator
        self.agent.model.generate_content = MagicMock(return_value=mock_response_iter)

        # Set the contextvar
        token = _stream_callback_var.set(_test_callback)
        try:
            result = await self.agent.generate("prompt", fallback="FALLBACK")
        finally:
            _stream_callback_var.reset(token)

        assert result == "Hello world!"
        assert chunks_received == ["Hello ", "world!"]

    async def test_generate_skips_contextvar_for_json_mode(self):
        """When generation_config has response_mime_type=application/json, skip streaming."""
        from app.agents.base import _stream_callback_var

        chunks_received = []

        async def _test_callback(text: str) -> None:
            chunks_received.append(text)

        self.agent.model = MagicMock()
        self.agent.model.generate_content = MagicMock(
            return_value=MagicMock(text='{"key": "value"}')
        )

        # Set the contextvar - should be ignored for JSON mode calls
        token = _stream_callback_var.set(_test_callback)
        try:
            result = await self.agent.generate(
                "prompt",
                fallback="FALLBACK",
                generation_config={"response_mime_type": "application/json"},
            )
        finally:
            _stream_callback_var.reset(token)

        # Should NOT have streamed
        assert chunks_received == []
        # Should have returned the non-streamed result
        assert result == '{"key": "value"}'


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


class TestPriorityAgent:
    """Tests for the PriorityAgent."""

    @pytest.fixture(autouse=True)
    def setup_priority(self, mock_vertexai_model, mock_mcp_client):
        """Set up the priority agent with mocked dependencies."""
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()

        with patch("app.agents.priority.vertexai.init"), \
             patch("app.agents.priority.GenerativeModel", return_value=mock_vertexai_model):
            from app.agents.priority import PriorityAgent

            self.agent = PriorityAgent(mcp_client=mock_mcp_client)
            self.mock_model = mock_vertexai_model
            self.mock_mcp = mock_mcp_client
            yield
            AgentRegistry._agents.clear()

    async def test_priority_ranking_order(self):
        """Test PriorityAgent ranks tasks by urgency with correct emoji indicators."""
        # Mock MCP to return tasks and events
        self.mock_mcp.call_tool = AsyncMock(side_effect=[
            # First call: list_tasks
            [
                {"id": "1", "title": "Finish report", "due": "2024-01-15T15:00:00Z"},
                {"id": "2", "title": "Prepare slides", "due": "2024-01-16T00:00:00Z"},
                {"id": "3", "title": "Call dentist", "due": ""},
            ],
            # Second call: list_events
            [
                {"id": "e1", "summary": "Team standup", "start": "2024-01-15T10:00:00Z"},
            ],
        ])

        # Mock Gemini to return ranked priorities
        priority_response = {
            "priorities": [
                {"title": "Finish report", "urgency": "high", "reason": "due in 3 hours"},
                {"title": "Prepare slides", "urgency": "medium", "reason": "due tomorrow"},
                {"title": "Call dentist", "urgency": "low", "reason": "no deadline"},
            ],
            "summary": "Here's what matters most right now:",
        }
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps(priority_response)
        )

        result = await self.agent.execute({
            "message": "what should I focus on?",
            "auth_token": "test-token",
            "user_id": "user123",
        })

        assert result["agent"] == "priority"
        assert result["action"] == "prioritize"
        assert len(result["priorities"]) == 3
        # Check ordering: high first, low last
        assert result["priorities"][0]["urgency"] == "high"
        assert result["priorities"][2]["urgency"] == "low"
        # Check content has emoji indicators
        assert "\U0001f534" in result["content"]  # red circle for high
        assert "\U0001f7e2" in result["content"]  # green circle for low
        assert "Finish report" in result["content"]

    async def test_priority_empty_state(self):
        """Test PriorityAgent handles no tasks gracefully."""
        # Mock MCP to return empty lists
        self.mock_mcp.call_tool = AsyncMock(return_value=[])

        # Mock Gemini returning empty priorities
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "priorities": [],
                "summary": "Nothing urgent right now!",
            })
        )

        result = await self.agent.execute({
            "message": "prioritize my tasks",
            "auth_token": "test-token",
            "user_id": "user123",
        })

        assert result["agent"] == "priority"
        assert "all clear" in result["content"].lower() or "no pressing" in result["content"].lower()
        assert result["priorities"] == []

    async def test_priority_fallback_without_gemini(self):
        """Test PriorityAgent falls back gracefully when Gemini returns invalid JSON."""
        self.mock_mcp.call_tool = AsyncMock(side_effect=[
            [{"id": "1", "title": "Task A", "due": ""}],
            [],
        ])

        # Gemini returns invalid JSON
        self.mock_model.generate_content.return_value = MagicMock(text="not json")

        result = await self.agent.execute({
            "message": "what's most important?",
            "auth_token": "test-token",
            "user_id": "user123",
        })

        # Should still return a valid response using fallback
        assert result["agent"] == "priority"
        assert result["priorities"] is not None


class TestSmartScheduling:
    """Tests for the scheduler's smart time suggestion feature."""

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

    async def test_suggest_time_prefers_morning(self):
        """Test that suggest_time picks morning slots for focus work."""
        # Gemini classifies as suggest_time
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "action": "suggest_time",
                "event_details": {
                    "summary": "Deep work",
                    "duration_minutes": 120,
                    "preferred_time": "morning",
                },
                "response": "Let me find time for deep work.",
            })
        )

        # Mock MCP to return free slots at various times
        self.mock_mcp.call_tool.return_value = [
            {"start": "2024-01-16T09:00:00+05:30", "duration_minutes": 120},
            {"start": "2024-01-16T14:00:00+05:30", "duration_minutes": 120},
            {"start": "2024-01-16T17:00:00+05:30", "duration_minutes": 120},
        ]

        result = await self.agent.execute({
            "message": "Find me 2 hours for deep work",
            "auth_token": "test-token",
        })

        assert result["agent"] == "scheduler"
        assert result["action"] == "suggest_time"
        # Should suggest the morning slot and ask for confirmation
        assert "9:00" in result["content"] or "9:" in result["content"]
        assert "block" in result["content"].lower() or "want" in result["content"].lower()
        # Should have a pending action for confirmation
        assert result.get("pending_action") is not None
        assert result["pending_action"]["awaiting"] == "confirmation"

    async def test_suggest_time_no_slots_available(self):
        """Test suggest_time handles no free slots gracefully."""
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "action": "suggest_time",
                "event_details": {
                    "summary": "Meeting prep",
                    "duration_minutes": 60,
                    "preferred_time": "any",
                },
                "response": "Looking for time.",
            })
        )

        # No free slots
        self.mock_mcp.call_tool.return_value = []

        result = await self.agent.execute({
            "message": "When should I work on the presentation?",
            "auth_token": "test-token",
        })

        assert result["agent"] == "scheduler"
        assert "couldn't find" in result["content"].lower() or "widen" in result["content"].lower()


class TestFocusSession:
    """Tests for the scheduler's focus session feature."""

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

    async def test_focus_session_creates_calendar_block(self):
        """Test that focus session creates a calendar event."""
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "action": "focus_session",
                "event_details": {
                    "summary": "Focus: presentation",
                    "duration_minutes": 90,
                },
                "response": "Starting a 90-minute focus session.",
            })
        )

        # Mock MCP create_event success
        self.mock_mcp.call_tool.return_value = {
            "id": "event_focus_1",
            "summary": "Focus: presentation",
            "start": "2024-01-15T10:00:00+05:30",
        }

        result = await self.agent.execute({
            "message": "Start a focus session for 90 minutes on the presentation",
            "auth_token": "test-token",
            "user_id": "user123",
        })

        assert result["agent"] == "scheduler"
        assert result["action"] == "focus_session"
        assert "focus" in result["content"].lower()
        assert "90 minutes" in result["content"]
        # Verify MCP was called to create the event
        self.mock_mcp.call_tool.assert_called()
        create_calls = [
            c for c in self.mock_mcp.call_tool.call_args_list
            if c[0][1] == "create_event"
        ]
        assert len(create_calls) == 1
        tool_args = create_calls[0][0][2]
        assert "Focus" in tool_args["summary"]

    async def test_focus_session_default_duration(self):
        """Test focus session defaults to 90 minutes when unspecified."""
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "action": "focus_session",
                "event_details": {
                    "summary": "Focus Time",
                    "duration_minutes": 90,
                },
                "response": "Starting focus mode.",
            })
        )

        self.mock_mcp.call_tool.return_value = {
            "id": "event_focus_2",
            "summary": "Focus Time",
            "start": "2024-01-15T10:00:00+05:30",
        }

        result = await self.agent.execute({
            "message": "Start focus mode",
            "auth_token": "test-token",
            "user_id": "user123",
        })

        assert result["action"] == "focus_session"
        assert "90 minutes" in result["content"]


class TestSubtaskDecomposition:
    """Tests for the planner's subtask decomposition feature."""

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

    async def test_decompose_creates_subtasks(self):
        """Test decompose action creates subtasks via MCP."""
        decompose_response = {
            "action": "decompose",
            "plan_summary": "Break down presentation prep",
            "tasks": [
                {"title": "Research key metrics", "notes": "", "due_days_from_now": 2, "priority": "high", "time_estimate": "30 min"},
                {"title": "Draft slide outline", "notes": "", "due_days_from_now": 3, "priority": "high", "time_estimate": "45 min"},
                {"title": "Design slides", "notes": "", "due_days_from_now": 4, "priority": "medium", "time_estimate": "1 hour"},
                {"title": "Practice run-through", "notes": "", "due_days_from_now": 5, "priority": "medium", "time_estimate": "20 min"},
            ],
            "response": "I've broken it down:",
        }
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps(decompose_response)
        )

        # Mock MCP create_task
        self.mock_mcp.call_tool.return_value = {"id": "task_new", "title": "subtask"}

        result = await self.agent.execute({
            "message": "Break down my presentation prep into steps",
            "auth_token": "test-token",
            "user_id": "user123",
        })

        assert result["agent"] == "planner"
        assert result["action"] == "decompose"
        assert len(result["tasks"]) == 4
        # Check formatting includes checkbox and time estimates
        assert "\u2610" in result["content"]  # empty checkbox
        assert "30 min" in result["content"]
        assert "Research key metrics" in result["content"]
        # MCP should have been called 4 times to create subtasks
        assert self.mock_mcp.call_tool.call_count == 4

    async def test_decompose_limits_to_6_subtasks(self):
        """Test that decomposition enforces the max 6 subtask limit."""
        # Gemini returns 8 subtasks (exceeds limit)
        decompose_response = {
            "action": "decompose",
            "plan_summary": "Break down big project",
            "tasks": [
                {"title": f"Step {i}", "notes": "", "due_days_from_now": i, "priority": "medium", "time_estimate": "30 min"}
                for i in range(1, 9)  # 8 subtasks
            ],
            "response": "I've broken it down:",
        }
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps(decompose_response)
        )

        self.mock_mcp.call_tool.return_value = {"id": "task_new", "title": "subtask"}

        result = await self.agent.execute({
            "message": "Decompose the project into steps",
            "auth_token": "test-token",
            "user_id": "user123",
        })

        assert result["action"] == "decompose"
        # Must be capped at 6
        assert len(result["tasks"]) <= 6
        # MCP should have been called at most 6 times
        assert self.mock_mcp.call_tool.call_count <= 6


class TestParallelAgentDispatch:
    """Tests for parallel multi-agent dispatch via asyncio.gather."""

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

    async def test_multi_agent_dispatch_runs_concurrently(self):
        """Two agents with a delay each should complete in ~1x delay, not 2x."""
        import asyncio
        import time

        from app.agents.base import AgentRegistry

        delay = 0.2  # seconds each agent "works"

        async def slow_execute_a(task):
            await asyncio.sleep(delay)
            return {"content": "Agent A done", "agent": "agent_a"}

        async def slow_execute_b(task):
            await asyncio.sleep(delay)
            return {"content": "Agent B done", "agent": "agent_b"}

        mock_agent_a = AsyncMock()
        mock_agent_a.execute = AsyncMock(side_effect=slow_execute_a)
        mock_agent_b = AsyncMock()
        mock_agent_b.execute = AsyncMock(side_effect=slow_execute_b)

        AgentRegistry._agents["agent_a"] = mock_agent_a
        AgentRegistry._agents["agent_b"] = mock_agent_b

        # Configure model to route to both agents
        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "intent": "multi_intent",
                "agents": ["agent_a", "agent_b"],
                "tasks": [
                    {"agent": "agent_a", "instruction": "Do task A"},
                    {"agent": "agent_b", "instruction": "Do task B"},
                ],
                "direct_response": None,
            })
        )

        start = time.monotonic()
        result = await self.agent.execute({
            "message": "Do task A and task B",
            "auth_token": "test-token",
            "conversation_history": [],
        })
        elapsed = time.monotonic() - start

        # Both agents should have been called
        mock_agent_a.execute.assert_called_once()
        mock_agent_b.execute.assert_called_once()

        # If sequential, elapsed would be >= 2*delay (0.4s).
        # If parallel, elapsed should be close to 1*delay (0.2s).
        # We allow up to 1.5x delay as the threshold to prove parallelism.
        assert elapsed < delay * 1.5, (
            f"Expected parallel execution (~{delay}s) but took {elapsed:.3f}s "
            f"(sequential would be ~{delay * 2}s)"
        )

    async def test_multi_agent_dispatch_emits_all_status_callbacks(self):
        """Status callbacks are emitted for every agent in multi-agent dispatch."""
        import asyncio

        from app.agents.base import AgentRegistry

        async def execute_a(task):
            return {"content": "A result", "agent": "agent_a"}

        async def execute_b(task):
            return {"content": "B result", "agent": "agent_b"}

        mock_agent_a = AsyncMock()
        mock_agent_a.execute = AsyncMock(side_effect=execute_a)
        mock_agent_b = AsyncMock()
        mock_agent_b.execute = AsyncMock(side_effect=execute_b)

        AgentRegistry._agents["agent_a"] = mock_agent_a
        AgentRegistry._agents["agent_b"] = mock_agent_b

        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "intent": "multi_intent",
                "agents": ["agent_a", "agent_b"],
                "tasks": [
                    {"agent": "agent_a", "instruction": "Do A"},
                    {"agent": "agent_b", "instruction": "Do B"},
                ],
                "direct_response": None,
            })
        )

        statuses = []

        async def status_callback(payload):
            statuses.append(payload)

        await self.agent.execute(
            {
                "message": "Do A and B",
                "auth_token": "test-token",
                "conversation_history": [],
            },
            status_callback=status_callback,
        )

        # A status callback should have been emitted for each agent
        assert len(statuses) == 2
        agent_names_in_status = {s["agent"] for s in statuses}
        assert "agent_a" in agent_names_in_status
        assert "agent_b" in agent_names_in_status
        for s in statuses:
            assert s["type"] == "status"
            assert s["content"]  # non-empty

    async def test_multi_agent_dispatch_partial_failure(self):
        """One agent failing should not crash the entire multi-agent turn."""
        from app.agents.base import AgentRegistry

        async def execute_success(task):
            return {"content": "Success result", "agent": "agent_ok"}

        async def execute_failure(task):
            raise RuntimeError("Agent exploded")

        mock_agent_ok = AsyncMock()
        mock_agent_ok.execute = AsyncMock(side_effect=execute_success)
        mock_agent_fail = AsyncMock()
        mock_agent_fail.execute = AsyncMock(side_effect=execute_failure)

        AgentRegistry._agents["agent_ok"] = mock_agent_ok
        AgentRegistry._agents["agent_fail"] = mock_agent_fail

        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "intent": "multi_intent",
                "agents": ["agent_ok", "agent_fail"],
                "tasks": [
                    {"agent": "agent_ok", "instruction": "Do OK thing"},
                    {"agent": "agent_fail", "instruction": "Do failing thing"},
                ],
                "direct_response": None,
            })
        )

        # Should NOT raise -- partial results are returned gracefully
        result = await self.agent.execute({
            "message": "Do both things",
            "auth_token": "test-token",
            "conversation_history": [],
        })

        # The successful agent's content should still be present
        assert "Success result" in result["content"]
        # Both agents were called
        mock_agent_ok.execute.assert_called_once()
        mock_agent_fail.execute.assert_called_once()

    async def test_multi_agent_streaming_partial_failure(self):
        """Partial failure in execute_streaming() multi-agent path is graceful."""
        from app.agents.base import AgentRegistry

        async def execute_success(task):
            return {"content": "Streaming success", "agent": "agent_ok"}

        async def execute_failure(task):
            raise ValueError("Streaming agent crashed")

        mock_agent_ok = AsyncMock()
        mock_agent_ok.execute = AsyncMock(side_effect=execute_success)
        mock_agent_fail = AsyncMock()
        mock_agent_fail.execute = AsyncMock(side_effect=execute_failure)

        AgentRegistry._agents["agent_ok"] = mock_agent_ok
        AgentRegistry._agents["agent_fail"] = mock_agent_fail

        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "intent": "multi_intent",
                "agents": ["agent_ok", "agent_fail"],
                "tasks": [
                    {"agent": "agent_ok", "instruction": "Do OK"},
                    {"agent": "agent_fail", "instruction": "Do fail"},
                ],
                "direct_response": None,
            })
        )

        chunks = []

        async def send_chunk(text):
            chunks.append(text)

        # Should NOT raise
        result = await self.agent.execute_streaming(
            {
                "message": "Do both",
                "auth_token": "test-token",
                "conversation_history": [],
            },
            send_chunk=send_chunk,
        )

        assert "Streaming success" in result["content"]
        mock_agent_ok.execute.assert_called_once()
        mock_agent_fail.execute.assert_called_once()

    async def test_multi_agent_streaming_dispatch_runs_concurrently(self):
        """Parallel dispatch also works in execute_streaming() multi-agent path."""
        import asyncio
        import time

        from app.agents.base import AgentRegistry

        delay = 0.2

        async def slow_execute_a(task):
            await asyncio.sleep(delay)
            return {"content": "Stream A done", "agent": "agent_a"}

        async def slow_execute_b(task):
            await asyncio.sleep(delay)
            return {"content": "Stream B done", "agent": "agent_b"}

        mock_agent_a = AsyncMock()
        mock_agent_a.execute = AsyncMock(side_effect=slow_execute_a)
        mock_agent_b = AsyncMock()
        mock_agent_b.execute = AsyncMock(side_effect=slow_execute_b)

        AgentRegistry._agents["agent_a"] = mock_agent_a
        AgentRegistry._agents["agent_b"] = mock_agent_b

        self.mock_model.generate_content.return_value = MagicMock(
            text=json.dumps({
                "intent": "multi_intent",
                "agents": ["agent_a", "agent_b"],
                "tasks": [
                    {"agent": "agent_a", "instruction": "Do task A"},
                    {"agent": "agent_b", "instruction": "Do task B"},
                ],
                "direct_response": None,
            })
        )

        chunks = []

        async def send_chunk(text):
            chunks.append(text)

        start = time.monotonic()
        result = await self.agent.execute_streaming(
            {
                "message": "Do task A and task B",
                "auth_token": "test-token",
                "conversation_history": [],
            },
            send_chunk=send_chunk,
        )
        elapsed = time.monotonic() - start

        mock_agent_a.execute.assert_called_once()
        mock_agent_b.execute.assert_called_once()

        # Parallel: elapsed should be closer to 1x delay, not 2x.
        assert elapsed < delay * 1.5, (
            f"Expected parallel execution (~{delay}s) but took {elapsed:.3f}s"
        )
        # Multi-agent path does not stream chunks (falls back to non-streaming)
        assert result["_streamed"] is False
