"""Email Agent - Manages email operations.

Handles drafting, summarizing, searching, and sending emails
using the Gmail MCP server and Vertex AI Gemini for content generation.
"""

import asyncio
import json
from typing import Any

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase
from app.config import settings


EMAIL_SYSTEM_PROMPT = """You are an email assistant agent. Your job is to help users manage their email.
You can perform the following actions:
1. Draft emails - compose professional email content based on user instructions
2. Summarize emails - read and summarize unread or recent emails
3. Send emails - send emails on behalf of the user
4. Search emails - find specific emails using Gmail query syntax

When given a user instruction, respond with a JSON object:
{
  "action": "draft_email|send_email|summarize_emails|search_emails|list_emails",
  "parameters": {
    // Parameters specific to the action
    "to": "recipient@example.com",  // for draft/send
    "subject": "Email subject",     // for draft/send
    "body": "Email body content",   // for draft/send
    "query": "search query",        // for search
    "max_results": 10               // for list/search
  },
  "response": "A natural language summary to share with the user"
}

For drafting emails:
- Generate professional, concise email content
- Infer the appropriate tone from context (formal for work, casual for friends)
- Include a clear subject line

For summarizing:
- First list recent emails, then provide a concise summary

For searching:
- Convert the user's natural language request into Gmail query syntax
  (e.g., "emails from John" -> "from:john", "unread emails" -> "is:unread")
"""


class EmailAgent(AgentBase):
    """Email agent that manages email operations.

    Uses Vertex AI Gemini for content generation and the Gmail MCP server
    for interacting with the user's email account.
    """

    name = "email"
    description = "Manages email operations including drafting, summarizing, and sending"
    capabilities = ["draft_email", "summarize_emails", "send_email", "search_emails"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the email agent with Vertex AI GenerativeModel.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel("gemini-2.5-flash")

    async def execute(self, task: dict) -> dict:
        """Handle email-related instructions.

        Args:
            task: Dict with 'message' (the instruction),
                  'auth_token' for Google API access.

        Returns:
            Dict with 'content' (response text), 'agent' name,
            and optional email operation results.
        """
        message = task.get("message", "")
        auth_token = task.get("auth_token", "")

        # Use Gemini to determine the action
        action_plan = await self._plan_action(message)

        action = action_plan.get("action", "")
        parameters = action_plan.get("parameters", {})

        # Require auth_token for all email operations
        if not auth_token:
            return {
                "content": "Authentication is required to access your email. Please sign in with your Google account first.",
                "agent": self.name,
                "action": action,
                "result": None,
            }

        # Execute the action via MCP tools
        result = None
        if action == "draft_email":
            result = await self._draft_email(auth_token, parameters)
        elif action == "send_email":
            result = await self._send_email(auth_token, parameters)
        elif action == "summarize_emails":
            result = await self._summarize_emails(auth_token, parameters)
        elif action == "search_emails":
            result = await self._search_emails(auth_token, parameters)
        elif action == "list_emails":
            result = await self._list_emails(auth_token, parameters)

        # Build response
        response_content = action_plan.get("response", "")
        if result and isinstance(result, dict) and result.get("error"):
            response_content += f"\n\nNote: {result['error']}"
        elif result and action == "draft_email":
            response_content += "\n\nDraft has been created in your Gmail drafts folder."
        elif result and action == "send_email":
            response_content += "\n\nEmail has been sent successfully."

        if not response_content:
            response_content = "I can help you with email tasks like drafting, sending, searching, or summarizing emails."

        return {
            "content": response_content,
            "agent": self.name,
            "action": action,
            "result": result,
        }

    async def _plan_action(self, message: str) -> dict:
        """Use Gemini to determine which email action to take.

        Args:
            message: The user's instruction.

        Returns:
            Action plan dictionary with action, parameters, and response.
        """
        try:
            prompt = f"""{EMAIL_SYSTEM_PROMPT}

User instruction: {message}"""

            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            return json.loads(response.text)
        except Exception:
            return {
                "action": "list_emails",
                "parameters": {"max_results": 10},
                "response": f"I'll check your recent emails regarding: '{message}'",
            }

    async def _draft_email(self, auth_token: str, parameters: dict) -> dict:
        """Create a draft email via MCP.

        Args:
            auth_token: Google OAuth access token.
            parameters: Dict with 'to', 'subject', 'body'.

        Returns:
            Draft creation result.
        """
        try:
            result = await self.call_mcp_tool(
                "google-gmail",
                "draft_email",
                {
                    "auth_token": auth_token,
                    "to": parameters.get("to", ""),
                    "subject": parameters.get("subject", ""),
                    "body": parameters.get("body", ""),
                },
            )
            return result
        except Exception as e:
            return {"error": str(e)}

    async def _send_email(self, auth_token: str, parameters: dict) -> dict:
        """Send an email via MCP.

        Args:
            auth_token: Google OAuth access token.
            parameters: Dict with 'to', 'subject', 'body'.

        Returns:
            Send result.
        """
        try:
            result = await self.call_mcp_tool(
                "google-gmail",
                "send_email",
                {
                    "auth_token": auth_token,
                    "to": parameters.get("to", ""),
                    "subject": parameters.get("subject", ""),
                    "body": parameters.get("body", ""),
                },
            )
            return result
        except Exception as e:
            return {"error": str(e)}

    async def _summarize_emails(self, auth_token: str, parameters: dict) -> dict:
        """List and summarize recent emails.

        Args:
            auth_token: Google OAuth access token.
            parameters: Dict with optional 'max_results'.

        Returns:
            Summary of recent emails.
        """
        try:
            # First, list recent emails
            emails = await self.call_mcp_tool(
                "google-gmail",
                "list_emails",
                {
                    "auth_token": auth_token,
                    "max_results": parameters.get("max_results", 10),
                },
            )
            return {"emails": emails, "count": len(emails) if isinstance(emails, list) else 0}
        except Exception as e:
            return {"error": str(e)}

    async def _search_emails(self, auth_token: str, parameters: dict) -> dict:
        """Search emails via MCP.

        Args:
            auth_token: Google OAuth access token.
            parameters: Dict with 'query' and optional 'max_results'.

        Returns:
            Search results.
        """
        try:
            result = await self.call_mcp_tool(
                "google-gmail",
                "search_emails",
                {
                    "auth_token": auth_token,
                    "query": parameters.get("query", ""),
                    "max_results": parameters.get("max_results", 10),
                },
            )
            return {"emails": result, "count": len(result) if isinstance(result, list) else 0}
        except Exception as e:
            return {"error": str(e)}

    async def _list_emails(self, auth_token: str, parameters: dict) -> dict:
        """List recent emails via MCP.

        Args:
            auth_token: Google OAuth access token.
            parameters: Dict with optional 'max_results' and 'label_ids'.

        Returns:
            List of recent emails.
        """
        try:
            result = await self.call_mcp_tool(
                "google-gmail",
                "list_emails",
                {
                    "auth_token": auth_token,
                    "max_results": parameters.get("max_results", 10),
                    "label_ids": parameters.get("label_ids", ["INBOX"]),
                },
            )
            return {"emails": result, "count": len(result) if isinstance(result, list) else 0}
        except Exception as e:
            return {"error": str(e)}
