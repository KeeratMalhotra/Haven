"""Tests for the AI intelligence upgrades: clarification / slot-filling,
pending-action memory, conflict detection, and reschedule/delete intents.

All Gemini and MCP calls are mocked so these run offline.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.utils.timectx import now_ist


def _gemini(text: str) -> MagicMock:
    return MagicMock(text=text)


# ---------------------------------------------------------------------------
# Scheduler: clarification, pending completion, conflicts, reschedule/delete
# ---------------------------------------------------------------------------


class TestSchedulerClarification:
    @pytest.fixture(autouse=True)
    def setup(self, mock_vertexai_model, mock_mcp_client):
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

    async def test_missing_time_asks_instead_of_creating(self):
        """HEADLINE: 'I have a meeting tomorrow' -> ask for time, create nothing."""
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "needs_info",
            "question": "What time is your meeting tomorrow?",
            "pending": {"summary": "Meeting", "start_time": "tomorrow", "duration_minutes": 60},
            "awaiting": "time",
            "intent": "create",
        }))

        result = await self.agent.execute({
            "message": "I have a meeting tomorrow",
            "auth_token": "test-token",
        })

        assert result["action"] == "needs_info"
        assert "time" in result["content"].lower()
        pa = result["pending_action"]
        assert pa is not None
        assert pa["agent"] == "scheduler"
        assert pa["awaiting"] == "time"
        assert pa["partial"]["summary"] == "Meeting"
        # Crucially: nothing was created.
        created = [c for c in self.mock_mcp.call_tool.call_args_list if c[0][1] == "create_event"]
        assert created == []

    async def test_python_safety_net_blocks_create_without_time(self):
        """Even if Gemini wrongly says create_event with only a day, we ask."""
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "create_event",
            "event_details": {"summary": "Meeting", "start_time": "tomorrow", "duration_minutes": 60},
            "response": "Creating your meeting.",
        }))

        result = await self.agent.execute({
            "message": "I have a meeting tomorrow",
            "auth_token": "test-token",
        })

        assert result["action"] == "needs_info"
        assert result["pending_action"]["awaiting"] == "time"
        created = [c for c in self.mock_mcp.call_tool.call_args_list if c[0][1] == "create_event"]
        assert created == []

    async def test_time_without_day_defaults_to_today(self):
        """'meeting at 6pm' (no day) -> create today, no clarification."""
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "create_event",
            "event_details": {"summary": "Meeting", "start_time": "today 18:00", "duration_minutes": 60},
            "response": "Creating your meeting.",
        }))

        async def call_tool(server, tool, args):
            if tool == "list_events":
                return []
            if tool == "create_event":
                return {"id": "e1", "summary": "Meeting", "start": args.get("start_time", "")}
            return {}

        self.mock_mcp.call_tool.side_effect = call_tool

        result = await self.agent.execute({
            "message": "I have a meeting at 6pm",
            "auth_token": "test-token",
        })

        assert result["action"] == "create_event"
        assert result["pending_action"] is None
        assert "Meeting" in result["content"]

    async def test_pending_completion_creates_event(self):
        """Turn 2: answering the time completes the pending create."""
        # Gemini merges the answer into a full create.
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "create_event",
            "event_details": {"summary": "Meeting", "start_time": "tomorrow 18:00", "duration_minutes": 60},
            "response": "Scheduling it.",
        }))

        captured = {}

        async def call_tool(server, tool, args):
            if tool == "list_events":
                return []
            if tool == "create_event":
                captured["args"] = args
                return {"id": "e1", "summary": "Meeting", "start": args.get("start_time", "")}
            return {}

        self.mock_mcp.call_tool.side_effect = call_tool

        pending = {
            "agent": "scheduler",
            "intent": "create",
            "awaiting": "time",
            "question": "What time is your meeting tomorrow?",
            "partial": {"summary": "Meeting", "start_time": "tomorrow", "duration_minutes": 60},
        }

        result = await self.agent.execute({
            "message": "6pm",
            "auth_token": "test-token",
            "pending_action": pending,
        })

        assert result["action"] == "create_event"
        assert result["pending_action"] is None
        assert "Meeting" in result["content"]
        # The created event resolved to TOMORROW at 18:00 IST.
        start = captured["args"]["start_time"]
        assert "18:00:00" in start
        expected_date = (now_ist().date()).fromordinal(now_ist().toordinal() + 1).isoformat()
        assert expected_date in start

    async def test_conflict_detection_asks_before_creating(self):
        """An overlapping event triggers a confirmation instead of a silent create."""
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "create_event",
            "event_details": {"summary": "Sync", "start_time": "today 18:00", "duration_minutes": 60},
            "response": "Scheduling it.",
        }))

        busy_start = now_ist().replace(hour=18, minute=30, second=0, microsecond=0)
        busy_end = now_ist().replace(hour=19, minute=30, second=0, microsecond=0)

        async def call_tool(server, tool, args):
            if tool == "list_events":
                return [{
                    "id": "x",
                    "summary": "Existing Call",
                    "start": busy_start.isoformat(),
                    "end": busy_end.isoformat(),
                }]
            if tool == "create_event":
                return {"id": "should-not-happen"}
            return {}

        self.mock_mcp.call_tool.side_effect = call_tool

        result = await self.agent.execute({
            "message": "Schedule a sync at 6pm",
            "auth_token": "test-token",
        })

        assert result["action"] == "needs_info"
        pa = result["pending_action"]
        assert pa["awaiting"] == "confirmation"
        assert "Existing Call" in result["content"]
        assert "anyway" in result["content"].lower()
        created = [c for c in self.mock_mcp.call_tool.call_args_list if c[0][1] == "create_event"]
        assert created == []

    async def test_conflict_confirmation_yes_creates(self):
        """Answering 'yes' to a conflict warning proceeds with the create."""
        start_iso = now_ist().replace(hour=18, minute=0, second=0, microsecond=0).isoformat()

        created = {"called": False, "listed": False}

        async def call_tool(server, tool, args):
            if tool == "list_events":
                created["listed"] = True
                return []
            if tool == "create_event":
                created["called"] = True
                return {"id": "e1", "summary": "Sync", "start": args.get("start_time", "")}
            return {}

        self.mock_mcp.call_tool.side_effect = call_tool

        pending = {
            "agent": "scheduler",
            "intent": "create",
            "awaiting": "confirmation",
            "question": 'You already have "X" at 6pm. Want me to schedule "Sync" anyway?',
            "partial": {"summary": "Sync", "start_time": start_iso, "duration_minutes": 60},
        }

        result = await self.agent.execute({
            "message": "yes, schedule it anyway",
            "auth_token": "test-token",
            "pending_action": pending,
        })

        assert result["action"] == "create_event"
        assert result["pending_action"] is None
        assert created["called"] is True
        # Confirmed creates skip the conflict re-check (no list_events call).
        assert created["listed"] is False

    async def test_conflict_confirmation_no_cancels(self):
        pending = {
            "agent": "scheduler",
            "intent": "create",
            "awaiting": "confirmation",
            "question": "Want me to schedule it anyway?",
            "partial": {"summary": "Sync", "start_time": now_ist().isoformat(), "duration_minutes": 60},
        }
        result = await self.agent.execute({
            "message": "no, never mind",
            "auth_token": "test-token",
            "pending_action": pending,
        })
        assert result["action"] == "cancel"
        assert result["pending_action"] is None
        created = [c for c in self.mock_mcp.call_tool.call_args_list if c[0][1] == "create_event"]
        assert created == []

    async def test_delete_single_match(self):
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "delete_event",
            "event_details": {"match": "dentist"},
            "response": "Cancelling it.",
        }))

        deleted = {}

        async def call_tool(server, tool, args):
            if tool == "list_events":
                return [{
                    "id": "d1",
                    "summary": "Dentist appointment",
                    "start": now_ist().replace(hour=15, minute=0).isoformat(),
                    "end": now_ist().replace(hour=16, minute=0).isoformat(),
                }]
            if tool == "delete_event":
                deleted["id"] = args.get("event_id")
                return {"success": True, "deleted_event_id": args.get("event_id")}
            return {}

        self.mock_mcp.call_tool.side_effect = call_tool

        result = await self.agent.execute({
            "message": "cancel my dentist appointment",
            "auth_token": "test-token",
        })

        assert result["action"] == "delete_event"
        assert deleted.get("id") == "d1"
        assert "cancelled" in result["content"].lower()

    async def test_delete_multiple_matches_asks_which(self):
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "delete_event",
            "event_details": {"match": "meeting"},
            "response": "Cancelling.",
        }))

        async def call_tool(server, tool, args):
            if tool == "list_events":
                return [
                    {"id": "m1", "summary": "Team meeting", "start": now_ist().replace(hour=10).isoformat()},
                    {"id": "m2", "summary": "Client meeting", "start": now_ist().replace(hour=14).isoformat()},
                ]
            return {}

        self.mock_mcp.call_tool.side_effect = call_tool

        result = await self.agent.execute({
            "message": "cancel my meeting",
            "auth_token": "test-token",
        })

        assert result["action"] == "needs_info"
        assert result["pending_action"]["awaiting"] == "which"
        deleted = [c for c in self.mock_mcp.call_tool.call_args_list if c[0][1] == "delete_event"]
        assert deleted == []

    async def test_reschedule_moves_event(self):
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "reschedule_event",
            "event_details": {"match": "6pm", "new_time": "today 20:00"},
            "response": "Moving it.",
        }))

        ops = []

        async def call_tool(server, tool, args):
            ops.append(tool)
            if tool == "list_events":
                return [{
                    "id": "r1",
                    "summary": "Standup",
                    "start": now_ist().replace(hour=18, minute=0, second=0, microsecond=0).isoformat(),
                    "end": now_ist().replace(hour=18, minute=30, second=0, microsecond=0).isoformat(),
                }]
            if tool == "delete_event":
                return {"success": True}
            if tool == "create_event":
                return {"id": "r2", "summary": "Standup", "start": args.get("start_time", "")}
            return {}

        self.mock_mcp.call_tool.side_effect = call_tool

        result = await self.agent.execute({
            "message": "move my 6pm to 8pm",
            "auth_token": "test-token",
        })

        assert result["action"] == "reschedule_event"
        assert "delete_event" in ops
        assert "create_event" in ops
        assert "moved" in result["content"].lower()


# ---------------------------------------------------------------------------
# Planner: deadline clarification
# ---------------------------------------------------------------------------


class TestPlannerClarification:
    @pytest.fixture(autouse=True)
    def setup(self, mock_vertexai_model, mock_mcp_client):
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

    async def test_implied_deadline_asks_when(self):
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "needs_info",
            "question": "When is the report due?",
            "pending": {"title": "Finish report", "notes": ""},
            "awaiting": "deadline",
            "intent": "create",
        }))

        result = await self.agent.execute({
            "message": "I have a report due",
            "auth_token": "test-token",
            "user_id": "",
        })

        assert result["action"] == "needs_info"
        assert "due" in result["content"].lower()
        pa = result["pending_action"]
        assert pa["awaiting"] == "deadline"
        created = [c for c in self.mock_mcp.call_tool.call_args_list if c[0][1] == "create_task"]
        assert created == []

    async def test_pending_deadline_completion_creates_task(self):
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "create_tasks",
            "tasks": [{"title": "Finish report", "notes": "", "due_days_from_now": 3, "priority": "high"}],
            "response": "Got it — added the report.",
        }))
        self.mock_mcp.call_tool.return_value = {"id": "t1", "title": "Finish report"}

        pending = {
            "agent": "planner",
            "intent": "create",
            "awaiting": "deadline",
            "question": "When is the report due?",
            "partial": {"title": "Finish report", "notes": ""},
        }

        result = await self.agent.execute({
            "message": "this Friday",
            "auth_token": "test-token",
            "user_id": "",
            "pending_action": pending,
        })

        assert result["action"] == "create_tasks"
        assert result["pending_action"] is None
        created = [c for c in self.mock_mcp.call_tool.call_args_list if c[0][1] == "create_task"]
        assert len(created) == 1

    async def test_simple_task_no_deadline_just_creates(self):
        """'add a task to call mom' should NOT ask for a deadline."""
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "action": "create_tasks",
            "tasks": [{"title": "Call mom", "notes": "", "due_days_from_now": 7, "priority": "low"}],
            "response": "Added a task to call mom.",
        }))
        self.mock_mcp.call_tool.return_value = {"id": "t1", "title": "Call mom"}

        result = await self.agent.execute({
            "message": "add a task to call mom",
            "auth_token": "test-token",
            "user_id": "",
        })

        assert result["action"] == "create_tasks"
        assert result["pending_action"] is None


# ---------------------------------------------------------------------------
# Orchestrator: pending-action memory across turns
# ---------------------------------------------------------------------------


class TestOrchestratorPending:
    @pytest.fixture(autouse=True)
    def setup(self, mock_vertexai_model, mock_mcp_client):
        from app.agents.base import AgentRegistry

        AgentRegistry._agents.clear()
        with patch("app.agents.orchestrator.vertexai.init"), \
             patch("app.agents.orchestrator.GenerativeModel", return_value=mock_vertexai_model):
            from app.agents.orchestrator import OrchestratorAgent

            self.agent = OrchestratorAgent(mcp_client=mock_mcp_client)
            self.mock_model = mock_vertexai_model
            yield
            AgentRegistry._agents.clear()

    async def test_two_turn_clarification_flow(self):
        """Turn 1 asks the time; turn 2 (the answer) completes via the same agent."""
        from app.agents.base import AgentRegistry

        pending = {
            "agent": "scheduler",
            "intent": "create",
            "awaiting": "time",
            "question": "What time is your meeting tomorrow?",
            "partial": {"summary": "Meeting", "start_time": "tomorrow"},
        }

        mock_scheduler = AsyncMock()
        mock_scheduler.execute = AsyncMock(side_effect=[
            {
                "content": "What time is your meeting tomorrow?",
                "agent": "scheduler",
                "action": "needs_info",
                "pending_action": pending,
            },
            {
                "content": 'Done — "Meeting" on Sun, 29 Jun at 6:00 PM IST.',
                "agent": "scheduler",
                "action": "create_event",
                "pending_action": None,
            },
        ])
        AgentRegistry._agents["scheduler"] = mock_scheduler

        conv: list[dict] = []

        # Turn 1: route to scheduler.
        self.mock_model.generate_content.return_value = _gemini(json.dumps({
            "intent": "create_event",
            "agents": ["scheduler"],
            "tasks": [{"agent": "scheduler", "instruction": "Create event: meeting tomorrow"}],
            "direct_response": None,
        }))

        r1 = await self.agent.execute({
            "message": "I have a meeting tomorrow",
            "auth_token": "test-token",
            "conversation_history": conv,
        })

        assert "time" in r1["content"].lower()
        pa = r1["pending_action"]
        assert pa is not None and pa["awaiting"] == "time"

        # Turn 2: classify the short reply as an answer.
        self.mock_model.generate_content.return_value = _gemini(json.dumps({"resolution": "answer"}))

        r2 = await self.agent.execute({
            "message": "6pm",
            "auth_token": "test-token",
            "conversation_history": conv,
            "pending_action": pa,
        })

        assert "Done" in r2["content"]
        assert r2["pending_action"] is None
        assert mock_scheduler.execute.call_count == 2
        second_task = mock_scheduler.execute.call_args_list[1][0][0]
        assert second_task["pending_action"] == pa
        assert second_task["message"] == "6pm"

    async def test_topic_change_drops_pending(self):
        """If the user changes topic, the pending action is abandoned."""
        from app.agents.base import AgentRegistry

        pending = {
            "agent": "scheduler",
            "intent": "create",
            "awaiting": "time",
            "question": "What time is your meeting tomorrow?",
            "partial": {"summary": "Meeting"},
        }

        mock_planner = AsyncMock()
        mock_planner.execute = AsyncMock(return_value={
            "content": "You have 2 tasks.",
            "agent": "planner",
            "action": "list_tasks",
            "pending_action": None,
        })
        AgentRegistry._agents["planner"] = mock_planner

        # First call: classification -> new_topic. Second call: normal routing to planner.
        self.mock_model.generate_content.side_effect = [
            _gemini(json.dumps({"resolution": "new_topic"})),
            _gemini(json.dumps({
                "intent": "list_tasks",
                "agents": ["planner"],
                "tasks": [{"agent": "planner", "instruction": "List tasks"}],
                "direct_response": None,
            })),
        ]

        result = await self.agent.execute({
            "message": "actually, what tasks do I have?",
            "auth_token": "test-token",
            "conversation_history": [],
            "pending_action": pending,
        })

        assert "2 tasks" in result["content"]
        # Pending was dropped; planner doesn't set a new one.
        assert result["pending_action"] is None
        mock_planner.execute.assert_called_once()
