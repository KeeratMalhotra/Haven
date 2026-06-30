"""Slides Agent - Creates Google Slides presentations.

Handles presentation creation by calling the Google Slides MCP server
to generate an outline and then create the actual presentation.
"""

import json
import logging
from typing import Any

from app.agents.base import AgentBase

logger = logging.getLogger(__name__)


class SlidesAgent(AgentBase):
    """Slides agent that creates Google Slides presentations.

    Calls the google-slides MCP server to generate an outline from the user's
    description and then create a presentation, returning the URL.
    """

    name = "slides"
    description = "Creates Google Slides presentations from task context, generates outlines"
    capabilities = ["generate_outline", "create_presentation"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the slides agent.

        Args:
            mcp_client: MCP client for calling the google-slides server tools.
        """
        super().__init__(mcp_client)

    async def execute(self, task: dict) -> dict:
        """Create a presentation based on the user's instruction.

        Calls generate_outline with the user's description, then calls
        create_presentation with the resulting outline. Returns a friendly
        message containing the presentation URL.

        Args:
            task: Dict with 'message' (the instruction) and 'auth_token'
                  for Google API access.

        Returns:
            Dict with 'content' (response text), 'agent' name, and 'action'.
        """
        message = task.get("message", "") or task.get("original_message", "")
        auth_token = task.get("auth_token", "")

        if not auth_token:
            return {
                "content": "Authentication is required to create a presentation. Please sign in with your Google account and connect Google Slides in Settings.",
                "agent": self.name,
                "action": "create_presentation",
            }

        if not self.mcp_client:
            return {
                "content": "The slides service is not available right now. Please try again later.",
                "agent": self.name,
                "action": "create_presentation",
            }

        # Step 1: Generate outline from the user's description
        try:
            outline_result = await self.mcp_client.call_tool(
                "google-slides",
                "generate_outline",
                {
                    "auth_token": auth_token,
                    "task_title": message,
                    "task_notes": "",
                    "task_subtasks": [],
                },
            )
        except Exception as e:
            logger.error(f"[slides] Failed to generate outline: {e}", exc_info=True)
            return {
                "content": f"I was unable to generate a presentation outline. Error: {e}",
                "agent": self.name,
                "action": "generate_outline",
            }

        # Parse the outline result (MCP returns JSON text content)
        outline = self._parse_mcp_result(outline_result)

        if isinstance(outline, dict) and outline.get("error"):
            return {
                "content": f"I could not generate the outline: {outline['error']}",
                "agent": self.name,
                "action": "generate_outline",
            }

        if not isinstance(outline, dict) or "slides" not in outline:
            return {
                "content": "I was unable to generate a valid presentation outline. Please try again with more details about what the presentation should cover.",
                "agent": self.name,
                "action": "generate_outline",
            }

        # Step 2: Create the presentation from the outline
        try:
            create_result = await self.mcp_client.call_tool(
                "google-slides",
                "create_presentation",
                {
                    "auth_token": auth_token,
                    "outline": outline,
                },
            )
        except Exception as e:
            logger.error(f"[slides] Failed to create presentation: {e}", exc_info=True)
            return {
                "content": f"I generated an outline but failed to create the presentation. Error: {e}",
                "agent": self.name,
                "action": "create_presentation",
            }

        # Parse the creation result
        result = self._parse_mcp_result(create_result)

        if isinstance(result, dict) and result.get("error"):
            return {
                "content": f"I generated an outline but could not create the presentation: {result['error']}",
                "agent": self.name,
                "action": "create_presentation",
            }

        presentation_url = ""
        if isinstance(result, dict):
            presentation_url = result.get("presentation_url", "")

        if not presentation_url:
            return {
                "content": "The presentation was created but I could not retrieve the URL. Please check your Google Drive for the new presentation.",
                "agent": self.name,
                "action": "create_presentation",
            }

        # Build a friendly response
        title = outline.get("title", "your presentation")
        slide_count = len(outline.get("slides", []))
        content = (
            f"I have created your presentation: **{title}**\n\n"
            f"It has {slide_count} slides covering the key topics.\n\n"
            f"[Open in Google Slides]({presentation_url})"
        )

        return {
            "content": content,
            "agent": self.name,
            "action": "create_presentation",
        }

    @staticmethod
    def _parse_mcp_result(result: Any) -> Any:
        """Parse an MCP tool result which may be a JSON string or list of TextContent.

        Args:
            result: The raw result from mcp_client.call_tool.

        Returns:
            Parsed dict/list or the raw result if parsing fails.
        """
        # If it is already a dict, return as-is
        if isinstance(result, dict):
            return result

        # MCP results are often a list of TextContent objects
        if isinstance(result, list):
            for item in result:
                text = None
                if hasattr(item, "text"):
                    text = item.text
                elif isinstance(item, dict) and "text" in item:
                    text = item["text"]
                if text:
                    try:
                        return json.loads(text)
                    except (json.JSONDecodeError, TypeError):
                        continue

        # Try parsing as a JSON string directly
        if isinstance(result, str):
            try:
                return json.loads(result)
            except (json.JSONDecodeError, TypeError):
                pass

        return result
