"""Tests for MCP server tool handler functions.

Imports the server modules directly and calls their internal handler
functions with mocked Google API service objects.
"""

import importlib
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add MCP server directories to path so we can import them
_mcp_root = Path(__file__).resolve().parent.parent.parent / "mcp-servers"


def _import_server_module(server_dir: str):
    """Import a specific MCP server module by its directory name."""
    server_path = str(_mcp_root / server_dir)
    if server_path not in sys.path:
        sys.path.insert(0, server_path)

    # Force reload to ensure we get the correct module from the right path
    spec = importlib.util.spec_from_file_location(
        f"server_{server_dir.replace('-', '_')}",
        str(_mcp_root / server_dir / "server.py"),
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestCalendarMCPServer:
    """Tests for the Google Calendar MCP server tools."""

    @pytest.fixture
    def calendar_module(self):
        """Import the calendar server module."""
        return _import_server_module("google-calendar")

    @pytest.fixture
    def mock_calendar_service(self):
        """Create a mock Google Calendar API service."""
        service = MagicMock()
        events = MagicMock()
        service.events.return_value = events
        return service, events

    async def test_calendar_list_events(self, calendar_module, mock_calendar_service):
        """Mock Google Calendar API service, call _list_events."""
        service, events_resource = mock_calendar_service

        mock_list_result = {
            "items": [
                {
                    "id": "event1",
                    "summary": "Team Standup",
                    "start": {"dateTime": "2024-01-15T09:00:00Z"},
                    "end": {"dateTime": "2024-01-15T09:30:00Z"},
                    "location": "Room A",
                    "description": "Daily standup",
                },
                {
                    "id": "event2",
                    "summary": "Lunch",
                    "start": {"dateTime": "2024-01-15T12:00:00Z"},
                    "end": {"dateTime": "2024-01-15T13:00:00Z"},
                    "location": "",
                    "description": "",
                },
            ]
        }
        events_resource.list.return_value.execute.return_value = mock_list_result

        # Patch the function on the loaded module
        original_fn = calendar_module.get_calendar_service
        calendar_module.get_calendar_service = MagicMock(return_value=service)
        try:
            result = await calendar_module._list_events("fake-token", days_ahead=7, max_results=20)
        finally:
            calendar_module.get_calendar_service = original_fn

        assert len(result) == 2
        assert result[0]["summary"] == "Team Standup"
        assert result[0]["id"] == "event1"
        assert result[1]["summary"] == "Lunch"

    async def test_calendar_create_event(self, calendar_module, mock_calendar_service):
        """Mock service, call _create_event."""
        service, events_resource = mock_calendar_service

        mock_created = {
            "id": "new_event_1",
            "summary": "New Meeting",
            "start": {"dateTime": "2024-01-16T10:00:00Z"},
            "end": {"dateTime": "2024-01-16T11:00:00Z"},
            "htmlLink": "https://calendar.google.com/event/new_event_1",
        }
        events_resource.insert.return_value.execute.return_value = mock_created

        original_fn = calendar_module.get_calendar_service
        calendar_module.get_calendar_service = MagicMock(return_value=service)
        try:
            result = await calendar_module._create_event("fake-token", {
                "summary": "New Meeting",
                "description": "Discuss project",
                "start_time": "2024-01-16T10:00:00",
                "end_time": "2024-01-16T11:00:00",
            })
        finally:
            calendar_module.get_calendar_service = original_fn

        assert result["id"] == "new_event_1"
        assert result["summary"] == "New Meeting"
        assert "link" in result


class TestTasksMCPServer:
    """Tests for the Google Tasks MCP server tools."""

    @pytest.fixture
    def tasks_module(self):
        """Import the tasks server module."""
        return _import_server_module("google-tasks")

    @pytest.fixture
    def mock_tasks_service(self):
        """Create a mock Google Tasks API service."""
        service = MagicMock()
        tasks = MagicMock()
        service.tasks.return_value = tasks
        return service, tasks

    async def test_tasks_list_tasks(self, tasks_module, mock_tasks_service):
        """Mock Google Tasks API service, call _list_tasks."""
        service, tasks_resource = mock_tasks_service

        mock_list_result = {
            "items": [
                {
                    "id": "task1",
                    "title": "Buy groceries",
                    "notes": "Milk, eggs, bread",
                    "due": "2024-01-20T00:00:00.000Z",
                    "status": "needsAction",
                    "updated": "2024-01-14T10:00:00.000Z",
                },
                {
                    "id": "task2",
                    "title": "Read chapter 5",
                    "notes": "",
                    "due": "2024-01-18T00:00:00.000Z",
                    "status": "needsAction",
                    "updated": "2024-01-14T11:00:00.000Z",
                },
            ]
        }
        tasks_resource.list.return_value.execute.return_value = mock_list_result

        original_fn = tasks_module.get_tasks_service
        tasks_module.get_tasks_service = MagicMock(return_value=service)
        try:
            result = await tasks_module._list_tasks("fake-token")
        finally:
            tasks_module.get_tasks_service = original_fn

        assert len(result) == 2
        assert result[0]["title"] == "Buy groceries"
        assert result[0]["id"] == "task1"
        assert result[1]["title"] == "Read chapter 5"

    async def test_tasks_create_task(self, tasks_module, mock_tasks_service):
        """Mock service, call _create_task."""
        service, tasks_resource = mock_tasks_service

        mock_created = {
            "id": "new_task_1",
            "title": "Plan vacation",
            "notes": "Research destinations",
            "due": "2024-01-25T00:00:00.000Z",
            "status": "needsAction",
        }
        tasks_resource.insert.return_value.execute.return_value = mock_created

        original_fn = tasks_module.get_tasks_service
        tasks_module.get_tasks_service = MagicMock(return_value=service)
        try:
            result = await tasks_module._create_task("fake-token", {
                "title": "Plan vacation",
                "notes": "Research destinations",
                "due_days_from_now": 7,
            })
        finally:
            tasks_module.get_tasks_service = original_fn

        assert result["id"] == "new_task_1"
        assert result["title"] == "Plan vacation"
        assert result["status"] == "needsAction"


class TestGmailMCPServer:
    """Tests for the Google Gmail MCP server tools."""

    @pytest.fixture
    def gmail_module(self):
        """Import the gmail server module."""
        return _import_server_module("google-gmail")

    @pytest.fixture
    def mock_gmail_service(self):
        """Create a mock Google Gmail API service."""
        service = MagicMock()
        users = MagicMock()
        service.users.return_value = users
        messages = MagicMock()
        users.messages.return_value = messages
        drafts = MagicMock()
        users.drafts.return_value = drafts
        return service, messages, drafts

    async def test_gmail_list_emails(self, gmail_module, mock_gmail_service):
        """Mock Gmail API service, call _list_emails."""
        service, messages, drafts = mock_gmail_service

        # Mock list response
        messages.list.return_value.execute.return_value = {
            "messages": [
                {"id": "msg1"},
                {"id": "msg2"},
            ]
        }

        # Mock get for each message
        messages.get.return_value.execute.side_effect = [
            {
                "id": "msg1",
                "threadId": "thread1",
                "snippet": "Hey, are you free tomorrow?",
                "labelIds": ["INBOX"],
                "payload": {
                    "headers": [
                        {"name": "Subject", "value": "Quick question"},
                        {"name": "From", "value": "alice@example.com"},
                        {"name": "Date", "value": "Mon, 15 Jan 2024 10:00:00 +0000"},
                    ]
                },
            },
            {
                "id": "msg2",
                "threadId": "thread2",
                "snippet": "Meeting notes from today",
                "labelIds": ["INBOX"],
                "payload": {
                    "headers": [
                        {"name": "Subject", "value": "Meeting Notes"},
                        {"name": "From", "value": "bob@example.com"},
                        {"name": "Date", "value": "Mon, 15 Jan 2024 14:00:00 +0000"},
                    ]
                },
            },
        ]

        original_fn = gmail_module.get_gmail_service
        gmail_module.get_gmail_service = MagicMock(return_value=service)
        try:
            result = await gmail_module._list_emails("fake-token", max_results=10)
        finally:
            gmail_module.get_gmail_service = original_fn

        assert len(result) == 2
        assert result[0]["subject"] == "Quick question"
        assert result[0]["from"] == "alice@example.com"
        assert result[1]["subject"] == "Meeting Notes"

    async def test_gmail_send_email(self, gmail_module, mock_gmail_service):
        """Mock service, call _send_email."""
        service, messages, drafts = mock_gmail_service

        messages.send.return_value.execute.return_value = {
            "id": "sent_msg_1",
            "threadId": "thread_new",
            "labelIds": ["SENT"],
        }

        original_fn = gmail_module.get_gmail_service
        gmail_module.get_gmail_service = MagicMock(return_value=service)
        try:
            result = await gmail_module._send_email(
                "fake-token",
                to="recipient@example.com",
                subject="Test Subject",
                body="Hello, this is a test email.",
            )
        finally:
            gmail_module.get_gmail_service = original_fn

        assert result["id"] == "sent_msg_1"
        assert result["status"] == "sent"
