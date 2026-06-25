"""Orchestrator Agent - Brain of ChronAI.

Analyzes user intent using Gemini 2.5 Flash and routes to specialist agents.
"""

import json
from typing import Any

from google import genai

from app.agents.base import AgentBase, AgentRegistry
from app.config import settings


SYSTEM_PROMPT = """You are ChronAI's orchestrator agent. Your role is to:
1. Analyze the user's message to determine their intent.
2. Decide which specialist agent(s) should handle the request.
3. Consolidate responses into a helpful reply.

Available agents:
- planner: Breaks goals into subtasks with deadlines, manages task lists
- scheduler: Finds optimal time slots, manages calendar events
- notification: Generates reminders and proactive suggestions
- voice: Converts text to speech

Respond with a JSON object:
{
  "intent": "brief description of user intent",
  "agents": ["list", "of", "agent", "names", "to", "invoke"],
  "tasks": [
    {"agent": "agent_name", "instruction": "what the agent should do"}
  ],
  "direct_response": "your response if no agents needed, or null"
}

If the user is just chatting or asking a question that doesn't require any tools,
set agents to an empty list and provide a direct_response.
"""


class OrchestratorAgent(AgentBase):
    """Brain/Orchestrator agent that routes requests to specialist agents.

    Uses Google Gemini 2.5 Flash to analyze user intent and coordinate
    with specialist agents to fulfill requests.
    """

    name = "orchestrator"
    description = "Analyzes user intent and routes to specialist agents"
    capabilities = ["intent_analysis", "agent_routing", "response_consolidation"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the orchestrator with Gemini client.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = "gemini-2.5-flash"

    async def execute(self, task: dict) -> dict:
        """Analyze user message and route to appropriate agents.

        Args:
            task: Dict with 'message' (user input), 'auth_token', 'user_id',
                  and 'conversation_history' (per-connection list managed by caller).

        Returns:
            Dict with 'content' (response text), 'agent' (this agent's name),
            and 'metadata' (routing details).
        """
        message = task.get("message", "")
        auth_token = task.get("auth_token", "")
        conversation_history: list[dict] = task.get("conversation_history", [])

        # Add user message to per-connection history
        conversation_history.append({"role": "user", "content": message})

        # Analyze intent with Gemini
        routing = await self._analyze_intent(message, conversation_history)

        # If direct response (no agents needed)
        if routing.get("direct_response") and not routing.get("agents"):
            response_content = routing["direct_response"]
            conversation_history.append(
                {"role": "assistant", "content": response_content}
            )
            return {
                "content": response_content,
                "agent": self.name,
                "metadata": {"intent": routing.get("intent", ""), "routed_to": []},
            }

        # Route to specialist agents
        results = []
        for agent_task in routing.get("tasks", []):
            agent_name = agent_task.get("agent", "")
            instruction = agent_task.get("instruction", message)
            agent = AgentRegistry.get(agent_name)

            if agent:
                result = await agent.execute(
                    {
                        "message": instruction,
                        "original_message": message,
                        "auth_token": auth_token,
                    }
                )
                results.append(result)

        # Consolidate responses
        consolidated = await self._consolidate_responses(message, results)

        conversation_history.append(
            {"role": "assistant", "content": consolidated}
        )

        return {
            "content": consolidated,
            "agent": self.name,
            "metadata": {
                "intent": routing.get("intent", ""),
                "routed_to": routing.get("agents", []),
            },
        }

    async def _analyze_intent(self, message: str, conversation_history: list[dict]) -> dict:
        """Use Gemini to analyze user intent and determine routing.

        Args:
            message: The user's message to analyze.
            conversation_history: Per-connection conversation history.

        Returns:
            Routing dictionary with intent, agents, tasks, and direct_response.
        """
        try:
            # Build conversation for context
            history_text = ""
            for msg in conversation_history[-10:]:  # Last 10 messages for context
                role = msg["role"]
                content = msg["content"]
                history_text += f"{role}: {content}\n"

            prompt = f"""Conversation history:
{history_text}

Current user message: {message}

Analyze the intent and decide routing."""

            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config={
                    "system_instruction": SYSTEM_PROMPT,
                    "response_mime_type": "application/json",
                },
            )

            return json.loads(response.text)
        except Exception as e:
            # Fallback: treat as direct response
            return {
                "intent": "general_chat",
                "agents": [],
                "tasks": [],
                "direct_response": f"I understand you said: '{message}'. How can I help you with your tasks and schedule?",
            }

    async def _consolidate_responses(
        self, original_message: str, results: list[dict]
    ) -> str:
        """Consolidate multiple agent responses into a coherent reply.

        Args:
            original_message: The user's original message.
            results: List of result dicts from specialist agents.

        Returns:
            A consolidated response string.
        """
        if not results:
            return "I wasn't able to process that request. Could you try rephrasing?"

        if len(results) == 1:
            return results[0].get("content", "")

        # Multiple agent results - use Gemini to consolidate
        try:
            results_text = "\n\n".join(
                f"[{r.get('agent', 'unknown')} agent]: {r.get('content', '')}"
                for r in results
            )

            prompt = f"""The user asked: "{original_message}"

Multiple specialist agents provided responses:
{results_text}

Consolidate these into a single coherent and helpful response for the user.
Be concise but include all relevant information."""

            response = self.client.models.generate_content(
                model=self.model, contents=prompt
            )
            return response.text
        except Exception:
            # Fallback: concatenate
            return "\n\n".join(r.get("content", "") for r in results)
