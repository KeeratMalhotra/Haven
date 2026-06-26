"""Orchestrator Agent - Brain of ChronAI.

Analyzes user intent using Gemini 2.5 Flash via Vertex AI and routes to specialist agents.
"""

import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

import vertexai
from vertexai.generative_models import GenerativeModel

from app.agents.base import AgentBase, AgentRegistry
from app.config import settings


SYSTEM_PROMPT = """You are ChronAI's orchestrator agent. Your PRIMARY job is to route user requests to specialist agents. You are NOT a chatbot. You are a router.

CRITICAL RULE: When in doubt, ALWAYS route to an agent. Prefer routing over direct_response.

Available agents:
- scheduler: Manages calendar events, finds time slots, checks schedules, books meetings
- planner: Breaks goals into subtasks, manages task lists, tracks deadlines, organizes projects
- notification: Generates reminders, sets alerts, sends nudges, proactive suggestions
- voice: Converts text to speech
- email: Drafts emails, summarizes inbox, sends messages, manages drafts

ROUTING RULES (follow these strictly):
1. ANY mention of calendar, events, meetings, schedule, availability, "what's on", time slots, appointments -> route to "scheduler"
2. ANY mention of tasks, goals, deadlines, projects, to-do, to do, plans, priorities, objectives -> route to "planner"
3. ANY mention of reminders, notifications, nudges, alerts, "remind me", "don't forget" -> route to "notification"
4. ANY mention of email, drafts, messages, send, inbox, compose, reply -> route to "email"
5. Questions ABOUT calendar/tasks/emails (e.g. "What's on my calendar?", "Do I have any tasks?") ARE routed, not answered directly.
6. ONLY use direct_response for pure small talk: greetings ("hello", "hi", "hey"), thanks ("thank you", "thanks"), meta questions ("who are you", "what can you do", "what is ChronAI").

EXAMPLES of correct routing:
- "What's on my calendar?" -> scheduler with instruction "List the user's calendar events for this week"
- "Create a task to finish report by Friday" -> planner with instruction "Create a task: finish report, deadline: Friday"
- "Remind me about the meeting at 3pm" -> notification with instruction "Set a reminder for the user's meeting at 3pm"
- "Draft an email to john about the project" -> email with instruction "Draft an email to john about the project"
- "Do I have any deadlines this week?" -> planner with instruction "List tasks with deadlines this week"
- "Schedule a meeting with Sarah tomorrow at 2pm" -> scheduler with instruction "Schedule a meeting with Sarah tomorrow at 2pm"
- "What emails did I get today?" -> email with instruction "List today's emails"
- "Hello!" -> direct_response: "Hey! I'm ChronAI, your AI productivity assistant. I can help you manage your calendar, tasks, emails, and reminders. What would you like to do?"

Respond with a JSON object:
{
  "intent": "brief description of user intent",
  "agents": ["list", "of", "agent", "names", "to", "invoke"],
  "tasks": [
    {"agent": "agent_name", "instruction": "what the agent should do"}
  ],
  "direct_response": "your response if no agents needed, or null"
}

Remember: If the user's message relates to productivity, scheduling, tasks, email, or reminders in ANY way, you MUST route to an agent. Never answer those questions yourself with a direct_response.
"""


class OrchestratorAgent(AgentBase):
    """Brain/Orchestrator agent that routes requests to specialist agents.

    Uses Vertex AI Gemini 2.5 Flash to analyze user intent and coordinate
    with specialist agents to fulfill requests.
    """

    name = "orchestrator"
    description = "Analyzes user intent and routes to specialist agents"
    capabilities = ["intent_analysis", "agent_routing", "response_consolidation"]

    def __init__(self, mcp_client: Any = None):
        """Initialize the orchestrator with Vertex AI GenerativeModel.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        super().__init__(mcp_client)
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self.model = GenerativeModel("gemini-2.5-flash")

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
        print(f"[ORCHESTRATOR DEBUG] routing_result: intent={routing.get('intent')}, agents={routing.get('agents')}, has_direct={bool(routing.get('direct_response'))}")

        logger.info(f"[orchestrator] Routing: intent={routing.get('intent')}, agents={routing.get('agents', [])}")

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
                logger.info(f"[orchestrator] Dispatching to '{agent_name}': {instruction}")
                result = await agent.execute(
                    {
                        "message": instruction,
                        "original_message": message,
                        "auth_token": auth_token,
                    }
                )
                logger.info(f"[orchestrator] '{agent_name}' responded with {len(result.get('content', ''))} chars")
                results.append(result)
                print(f"[ORCHESTRATOR DEBUG] Agent '{agent_name}' returned: {result.get('content', '')[:100]}")

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

            prompt = f"""{SYSTEM_PROMPT}

Conversation history:
{history_text}

Current user message: {message}

Analyze the intent and decide routing."""

            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )

            return json.loads(response.text)
        except Exception as e:
            logger.error(f"[orchestrator] Intent analysis failed: {e}", exc_info=True)
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

            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
            )
            return response.text
        except Exception:
            # Fallback: concatenate
            return "\n\n".join(r.get("content", "") for r in results)
