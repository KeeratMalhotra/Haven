"""Google Calendar MCP Server.

Provides tools for interacting with Google Calendar API:
- list_events: List calendar events in a date range
- create_event: Create a new calendar event
- update_event: Update an existing calendar event in place
- find_free_slots: Find available time slots
- delete_event: Delete a calendar event by ID
"""

import json
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool


server = Server("google-calendar")

# Hardcoded timezone for all calendar operations (for now).
TIMEZONE_NAME = "Asia/Kolkata"
IST = ZoneInfo(TIMEZONE_NAME)


def now_ist() -> datetime:
    """Current timezone-aware datetime in Asia/Kolkata (IST)."""
    return datetime.now(IST)


def get_calendar_service(auth_token: str):
    """Create a Google Calendar API service instance.

    Args:
        auth_token: OAuth2 access token for authentication.

    Returns:
        Google Calendar API service resource.
    """
    credentials = Credentials(token=auth_token)
    return build("calendar", "v3", credentials=credentials)


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all available calendar tools."""
    return [
        Tool(
            name="list_events",
            description="List calendar events within a date range",
            inputSchema={
                "type": "object",
                "properties": {
                    "auth_token": {
                        "type": "string",
                        "description": "Google OAuth access token",
                    },
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days ahead to look (default: 7)",
                        "default": 7,
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of events to return (default: 20)",
                        "default": 20,
                    },
                },
                "required": ["auth_token"],
            },
        ),
        Tool(
            name="create_event",
            description="Create a new calendar event",
            inputSchema={
                "type": "object",
                "properties": {
                    "auth_token": {
                        "type": "string",
                        "description": "Google OAuth access token",
                    },
                    "summary": {
                        "type": "string",
                        "description": "Event title/summary",
                    },
                    "description": {
                        "type": "string",
                        "description": "Event description",
                        "default": "",
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Start time in ISO format (e.g., 2024-01-15T09:00:00)",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "End time in ISO format (e.g., 2024-01-15T10:00:00)",
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Duration in minutes (used if end_time not provided)",
                        "default": 60,
                    },
                    "location": {
                        "type": "string",
                        "description": "Event location",
                        "default": "",
                    },
                    "attendees": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of attendee email addresses",
                        "default": [],
                    },
                },
                "required": ["auth_token", "summary"],
            },
        ),
        Tool(
            name="update_event",
            description="Update an existing calendar event in place (preserves the event ID)",
            inputSchema={
                "type": "object",
                "properties": {
                    "auth_token": {
                        "type": "string",
                        "description": "Google OAuth access token",
                    },
                    "event_id": {
                        "type": "string",
                        "description": "The ID of the event to update",
                    },
                    "summary": {
                        "type": "string",
                        "description": "Updated event title/summary",
                    },
                    "description": {
                        "type": "string",
                        "description": "Updated event description",
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Updated start time in ISO format (e.g., 2024-01-15T09:00:00)",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "Updated end time in ISO format (e.g., 2024-01-15T10:00:00)",
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Duration in minutes (used to compute end_time when start_time is given but end_time is not)",
                        "default": 60,
                    },
                    "location": {
                        "type": "string",
                        "description": "Updated event location",
                    },
                },
                "required": ["auth_token", "event_id"],
            },
        ),
        Tool(
            name="find_free_slots",
            description="Find available time slots in the calendar",
            inputSchema={
                "type": "object",
                "properties": {
                    "auth_token": {
                        "type": "string",
                        "description": "Google OAuth access token",
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Required slot duration in minutes (default: 60)",
                        "default": 60,
                    },
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days ahead to search (default: 7)",
                        "default": 7,
                    },
                    "working_hours_start": {
                        "type": "integer",
                        "description": "Working hours start (0-23, default: 9)",
                        "default": 9,
                    },
                    "working_hours_end": {
                        "type": "integer",
                        "description": "Working hours end (0-23, default: 18)",
                        "default": 18,
                    },
                },
                "required": ["auth_token"],
            },
        ),
        Tool(
            name="delete_event",
            description="Delete a calendar event by its ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "auth_token": {
                        "type": "string",
                        "description": "Google OAuth access token",
                    },
                    "event_id": {
                        "type": "string",
                        "description": "The ID of the event to delete",
                    },
                },
                "required": ["auth_token", "event_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool execution requests.

    Args:
        name: The tool name to execute.
        arguments: Tool arguments dictionary.

    Returns:
        List of TextContent with the result.
    """
    auth_token = arguments.get("auth_token", "")

    if name == "list_events":
        result = await _list_events(
            auth_token,
            days_ahead=arguments.get("days_ahead", 7),
            max_results=arguments.get("max_results", 20),
        )
    elif name == "create_event":
        result = await _create_event(auth_token, arguments)
    elif name == "update_event":
        result = await _update_event(auth_token, arguments)
    elif name == "find_free_slots":
        result = await _find_free_slots(
            auth_token,
            duration_minutes=arguments.get("duration_minutes", 60),
            days_ahead=arguments.get("days_ahead", 7),
            working_hours_start=arguments.get("working_hours_start", 9),
            working_hours_end=arguments.get("working_hours_end", 18),
        )
    elif name == "delete_event":
        result = await _delete_event(auth_token, arguments.get("event_id", ""))
    else:
        result = {"error": f"Unknown tool: {name}"}

    return [TextContent(type="text", text=json.dumps(result, default=str))]


async def _list_events(
    auth_token: str, days_ahead: int = 7, max_results: int = 20
) -> list[dict]:
    """List upcoming calendar events.

    Args:
        auth_token: Google OAuth access token.
        days_ahead: Number of days to look ahead.
        max_results: Maximum number of events.

    Returns:
        List of event dictionaries.
    """
    try:
        service = get_calendar_service(auth_token)
        now = now_ist()
        time_max = now + timedelta(days=days_ahead)

        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=now.isoformat(),
                timeMax=time_max.isoformat(),
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
                timeZone=TIMEZONE_NAME,
            )
            .execute()
        )

        events = events_result.get("items", [])
        return [
            {
                "id": event.get("id", ""),
                "summary": event.get("summary", "No title"),
                "start": event.get("start", {}).get(
                    "dateTime", event.get("start", {}).get("date", "")
                ),
                "end": event.get("end", {}).get(
                    "dateTime", event.get("end", {}).get("date", "")
                ),
                "location": event.get("location", ""),
                "description": event.get("description", ""),
            }
            for event in events
        ]
    except Exception as e:
        return [{"error": str(e)}]


async def _create_event(auth_token: str, arguments: dict) -> dict:
    """Create a new calendar event.

    Args:
        auth_token: Google OAuth access token.
        arguments: Event details (summary, start_time, end_time, etc.).

    Returns:
        Created event data or error.
    """
    try:
        service = get_calendar_service(auth_token)

        # Handle start/end times
        start_time = arguments.get("start_time")
        end_time = arguments.get("end_time")
        duration_minutes = arguments.get("duration_minutes", 60)

        if not start_time:
            # Default to the next available hour, in IST.
            now = now_ist()
            start_time = now.replace(minute=0, second=0, microsecond=0) + timedelta(
                hours=1
            )
            start_time = start_time.isoformat()

        if not end_time:
            start_dt = datetime.fromisoformat(start_time)
            # Ensure the start is timezone-aware (assume IST when naive).
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=IST)
                start_time = start_dt.isoformat()
            end_dt = start_dt + timedelta(minutes=duration_minutes)
            end_time = end_dt.isoformat()

        event_body = {
            "summary": arguments.get("summary", "New Event"),
            "description": arguments.get("description", ""),
            "location": arguments.get("location", ""),
            "start": {"dateTime": start_time, "timeZone": TIMEZONE_NAME},
            "end": {"dateTime": end_time, "timeZone": TIMEZONE_NAME},
        }

        # Add attendees if provided
        attendees = arguments.get("attendees", [])
        if attendees:
            event_body["attendees"] = [{"email": email} for email in attendees]

        event = service.events().insert(calendarId="primary", body=event_body).execute()

        return {
            "id": event.get("id", ""),
            "summary": event.get("summary", ""),
            "start": event.get("start", {}).get("dateTime", ""),
            "end": event.get("end", {}).get("dateTime", ""),
            "link": event.get("htmlLink", ""),
        }
    except Exception as e:
        return {"error": str(e)}


async def _update_event(auth_token: str, arguments: dict) -> dict:
    """Update an existing calendar event in place.

    Uses the Calendar API's patch() so the event ID is preserved (no
    delete + recreate). Only the provided fields are changed.

    Args:
        auth_token: Google OAuth access token.
        arguments: Event details (event_id, optional summary, start_time,
            end_time, duration_minutes, description, location).

    Returns:
        Updated event data or error.
    """
    event_id = arguments.get("event_id", "")
    if not event_id:
        return {"error": "event_id is required"}

    try:
        service = get_calendar_service(auth_token)

        # Build a partial body containing only the fields being updated.
        event_body: dict = {}

        if arguments.get("summary") is not None:
            event_body["summary"] = arguments.get("summary")
        if arguments.get("description") is not None:
            event_body["description"] = arguments.get("description")
        if arguments.get("location") is not None:
            event_body["location"] = arguments.get("location")

        # Handle start/end times (mirror create_event's logic).
        start_time = arguments.get("start_time")
        end_time = arguments.get("end_time")
        duration_minutes = arguments.get("duration_minutes", 60)

        if start_time:
            start_dt = datetime.fromisoformat(start_time)
            # Ensure the start is timezone-aware (assume IST when naive).
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=IST)
                start_time = start_dt.isoformat()

            if not end_time:
                end_dt = start_dt + timedelta(minutes=duration_minutes)
                end_time = end_dt.isoformat()

            event_body["start"] = {"dateTime": start_time, "timeZone": TIMEZONE_NAME}
            event_body["end"] = {"dateTime": end_time, "timeZone": TIMEZONE_NAME}
        elif end_time:
            # end_time provided on its own.
            event_body["end"] = {"dateTime": end_time, "timeZone": TIMEZONE_NAME}

        event = (
            service.events()
            .patch(calendarId="primary", eventId=event_id, body=event_body)
            .execute()
        )

        return {
            "id": event.get("id", ""),
            "summary": event.get("summary", ""),
            "start": event.get("start", {}).get("dateTime", ""),
            "end": event.get("end", {}).get("dateTime", ""),
            "link": event.get("htmlLink", ""),
        }
    except Exception as e:
        return {"error": str(e)}


async def _find_free_slots(
    auth_token: str,
    duration_minutes: int = 60,
    days_ahead: int = 7,
    working_hours_start: int = 9,
    working_hours_end: int = 18,
) -> list[dict]:
    """Find free time slots in the calendar.

    Args:
        auth_token: Google OAuth access token.
        duration_minutes: Required duration for a free slot.
        days_ahead: Number of days ahead to search.
        working_hours_start: Start of working hours (0-23).
        working_hours_end: End of working hours (0-23).

    Returns:
        List of free slot dictionaries with start and end times.
    """
    try:
        service = get_calendar_service(auth_token)
        now = now_ist()

        # Fetch all events in the range
        time_max = now + timedelta(days=days_ahead)
        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=now.isoformat(),
                timeMax=time_max.isoformat(),
                singleEvents=True,
                orderBy="startTime",
                timeZone=TIMEZONE_NAME,
            )
            .execute()
        )
        events = events_result.get("items", [])

        # Build list of busy times (timezone-aware in IST)
        busy_times = []
        for event in events:
            start = event.get("start", {}).get("dateTime")
            end = event.get("end", {}).get("dateTime")
            if start and end:
                busy_times.append(
                    (
                        datetime.fromisoformat(start.replace("Z", "+00:00")).astimezone(IST),
                        datetime.fromisoformat(end.replace("Z", "+00:00")).astimezone(IST),
                    )
                )

        # Find free slots within working hours
        free_slots = []
        current_day = now.date()

        for day_offset in range(days_ahead):
            check_date = current_day + timedelta(days=day_offset)
            day_start = datetime(
                check_date.year, check_date.month, check_date.day,
                working_hours_start, 0, 0, tzinfo=IST,
            )
            day_end = datetime(
                check_date.year, check_date.month, check_date.day,
                working_hours_end, 0, 0, tzinfo=IST,
            )

            # Skip if day_start is in the past
            if day_start < now:
                day_start = now

            # Find gaps in this day
            slot_start = day_start
            for busy_start, busy_end in busy_times:
                if busy_start > day_end:
                    break
                if busy_end < slot_start:
                    continue

                # Check if there is a gap before this event
                if busy_start > slot_start:
                    gap_minutes = (busy_start - slot_start).total_seconds() / 60
                    if gap_minutes >= duration_minutes:
                        free_slots.append(
                            {
                                "start": slot_start.isoformat(),
                                "end": busy_start.isoformat(),
                                "duration_minutes": int(gap_minutes),
                            }
                        )

                slot_start = max(slot_start, busy_end)

            # Check remaining time after last event
            if slot_start < day_end:
                gap_minutes = (day_end - slot_start).total_seconds() / 60
                if gap_minutes >= duration_minutes:
                    free_slots.append(
                        {
                            "start": slot_start.isoformat(),
                            "end": day_end.isoformat(),
                            "duration_minutes": int(gap_minutes),
                        }
                    )

        return free_slots[:10]  # Return top 10 slots
    except Exception as e:
        return [{"error": str(e)}]


async def _delete_event(auth_token: str, event_id: str) -> dict:
    """Delete a calendar event.

    Args:
        auth_token: Google OAuth access token.
        event_id: The ID of the event to delete.

    Returns:
        Success status or error.
    """
    if not event_id:
        return {"error": "event_id is required"}

    try:
        service = get_calendar_service(auth_token)
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        return {"success": True, "deleted_event_id": event_id}
    except Exception as e:
        return {"error": str(e)}


async def main():
    """Run the MCP server using stdio transport."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
