"""Orchestrator Agent - Brain of ChronAI.

Analyzes user intent using Gemini 2.5 Flash via Vertex AI and routes to specialist agents.
"""

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
7. When the user STATES they have an event/meeting/appointment ("I have X at Y", "there's X at Y") -> route to "scheduler" with instruction "Create event: [title], [time]". This IS a create request even though they didn't say "create" or "schedule".

EXAMPLES of correct routing:
- "What's on my calendar?" -> scheduler with instruction "List the user's calendar events for this week"
- "Create a task to finish report by Friday" -> planner with instruction "Create a task: finish report, deadline: Friday"
- "Remind me about the meeting at 3pm" -> notification with instruction "Set a reminder for the user's meeting at 3pm"
- "Draft an email to john about the project" -> email with instruction "Draft an email to john about the project"
- "Do I have any deadlines this week?" -> planner with instruction "List tasks with deadlines this week"
- "Schedule a meeting with Sarah tomorrow at 2pm" -> scheduler with instruction "Schedule a meeting with Sarah tomorrow at 2pm"
- "What emails did I get today?" -> email with instruction "List today's emails"
- "I have a meeting at 6pm" -> scheduler with instruction "Create event: meeting, today at 6pm"
- "I have a dentist appointment tomorrow at 3" -> scheduler with instruction "Create event: dentist appointment, tomorrow at 3pm"
- "There's a team standup at 10am every Monday" -> scheduler with instruction "Create event: team standup, Monday at 10am"
- "Add gym to my calendar at 7am" -> scheduler with instruction "Create event: gym, today at 7am"
- "Move my 4pm meeting to 5pm" -> scheduler with instruction "Reschedule: move the 4pm event to 5pm today"
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
        self.model = GenerativeModel(settings.GEMINI_MODEL)

    async def execute(self, task: dict, status_callback: Any = None) -> dict:
        """Analyze user message and route to appropriate agents.

        Args:
            task: Dict with 'message' (user input), 'auth_token', 'user_id',
                  and 'conversation_history' (per-connection list managed by caller).
            status_callback: Optional async callable invoked with a status dict
                  (``{"type": "status", "content": ..., "agent": ...}``) before
                  each slow agent dispatch, so the caller can stream progress
                  to the user over the WebSocket.

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
                # Emit a real-time status update before the slow agent work.
                if status_callback:
                    try:
                        await status_callback(
                            {
                                "type": "status",
                                "content": self._status_for(agent_name),
                                "agent": agent_name,
                            }
                        )
                    except Exception as e:
                        logger.warning(f"[orchestrator] status_callback failed: {e}")

                logger.info(f"[orchestrator] Dispatching to '{agent_name}': {instruction}")
                result = await agent.execute(
                    {
                        "message": instruction,
                        "original_message": message,
                        "auth_token": auth_token,
                        "user_id": task.get("user", {}).get("sub", "") if isinstance(task.get("user"), dict) else "",
                    }
                )
                logger.info(f"[orchestrator] '{agent_name}' responded with {len(result.get('content', ''))} chars")
                results.append(result)

        # Consolidate responses (single-agent answers are returned directly,
        # with NO extra Gemini call).
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

    @staticmethod
    def _status_for(agent_name: str) -> str:
        """Return a friendly, present-tense status message for an agent."""
        return {
            "scheduler": "Checking your calendar...",
            "planner": "Organizing your tasks...",
            "notification": "Reviewing your reminders...",
            "email": "Looking through your email...",
            "voice": "Preparing a voice response...",
        }.get(agent_name, f"Working with {agent_name}...")

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

            text = await self.generate(
                prompt,
                generation_config={"response_mime_type": "application/json"},
                fallback="",
            )
            return json.loads(text)
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

        # Single-agent answers are returned verbatim — NO extra Gemini call.
        if len(results) == 1:
            return results[0].get("content", "")

        # Multiple agent results - use Gemini to consolidate
        results_text = "\n\n".join(
            f"[{r.get('agent', 'unknown')} agent]: {r.get('content', '')}"
            for r in results
        )

        prompt = f"""The user asked: "{original_message}"

Multiple specialist agents provided responses:
{results_text}

Consolidate these into a single coherent and helpful response for the user.
Be concise but include all relevant information."""

        # Fallback to plain concatenation if the model is slow or errors.
        fallback = "\n\n".join(r.get("content", "") for r in results)
        return await self.generate(prompt, fallback=fallback)
