"""WebSocket Connection Manager for tracking client connections by user ID.

Enables real-time push notifications to specific users by maintaining
a mapping of user_id to their active WebSocket connections.
"""

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections indexed by user_id.

    Supports multiple connections per user (e.g., multiple browser tabs)
    and provides methods to push messages to specific users.
    """

    def __init__(self):
        """Initialize the connection manager with an empty connections dict."""
        self._connections: dict[str, list[WebSocket]] = {}

    def connect(self, user_id: str, websocket: WebSocket) -> None:
        """Register a WebSocket connection for a user.

        Args:
            user_id: The authenticated user's ID.
            websocket: The active WebSocket connection.
        """
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected. Total connections: {len(self._connections[user_id])}")

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        """Remove a WebSocket connection for a user.

        Args:
            user_id: The user's ID.
            websocket: The WebSocket connection to remove.
        """
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
            logger.info(f"User {user_id} disconnected.")

    async def send_to_user(self, user_id: str, message: dict[str, Any]) -> int:
        """Send a JSON message to all active connections for a user.

        Args:
            user_id: The target user's ID.
            message: Dictionary to send as JSON.

        Returns:
            Number of connections the message was successfully sent to.
        """
        sent_count = 0
        if user_id not in self._connections:
            return sent_count

        disconnected = []
        for websocket in self._connections[user_id]:
            try:
                await websocket.send_json(message)
                sent_count += 1
            except Exception:
                disconnected.append(websocket)

        # Clean up broken connections
        for ws in disconnected:
            self.disconnect(user_id, ws)

        return sent_count

    def get_connected_users(self) -> list[str]:
        """Get a list of all currently connected user IDs.

        Returns:
            List of user_id strings with active connections.
        """
        return list(self._connections.keys())

    def is_connected(self, user_id: str) -> bool:
        """Check if a user has any active connections.

        Args:
            user_id: The user's ID to check.

        Returns:
            True if the user has at least one active connection.
        """
        return user_id in self._connections and len(self._connections[user_id]) > 0


# Global connection manager instance
connection_manager = ConnectionManager()
