"""Base class for all ChronAI agents."""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Callable, Optional

logger = logging.getLogger(__name__)

# Default timeout (seconds) for any single Vertex AI Gemini generation call.
# Kept below the MCP timeout (30s) so a slow model never blocks the whole turn.
GEMINI_TIMEOUT_SECONDS = 60.0


class AgentRegistry:
    """Registry for managing agent instances."""

    _agents: dict[str, "AgentBase"] = {}

    @classmethod
    def register(cls, agent: "AgentBase") -> None:
        """Register an agent in the global registry.

        Args:
            agent: The agent instance to register.
        """
        cls._agents[agent.name] = agent

    @classmethod
    def deregister(cls, agent_name: str) -> None:
        """Remove an agent from the registry.

        Args:
            agent_name: The name of the agent to deregister.
        """
        cls._agents.pop(agent_name, None)

    @classmethod
    def get(cls, agent_name: str) -> Optional["AgentBase"]:
        """Get an agent by name.

        Args:
            agent_name: The name of the agent to retrieve.

        Returns:
            The agent instance, or None if not found.
        """
        return cls._agents.get(agent_name)

    @classmethod
    def list_agents(cls) -> list[str]:
        """List all registered agent names.

        Returns:
            List of registered agent names.
        """
        return list(cls._agents.keys())


class AgentBase(ABC):
    """Abstract base class for all agents.

    All agents must inherit from this class and implement the execute method.
    Agents are automatically registered upon initialization.
    """

    name: str = "base"
    description: str = "Base agent"
    capabilities: list[str] = []

    def __init__(self, mcp_client: Any = None):
        """Initialize the agent and register it.

        Args:
            mcp_client: Optional MCP client for tool access.
        """
        self.mcp_client = mcp_client
        self._tools: dict[str, dict] = {}
        # Subclasses that use Vertex AI Gemini set self.model to a
        # GenerativeModel instance. Agents without an LLM leave it as None.
        self.model: Any = None
        # Optional streaming callback. When set by the orchestrator before
        # calling execute(), generate() will use Gemini streaming mode and
        # forward each text chunk through this callback.
        self._stream_callback: Optional[Callable[[str], Any]] = None
        AgentRegistry.register(self)

    @abstractmethod
    async def execute(self, task: dict) -> dict:
        """Execute a task and return the result.

        Args:
            task: Dictionary containing task details. Expected keys vary by agent
                  but typically include 'message', 'user_id', and 'context'.

        Returns:
            Dictionary containing the result. Always includes 'content' key
            with the response text or data, and 'agent' with this agent's name.
        """
        ...

    async def generate(
        self,
        prompt: str,
        *,
        fallback: str = "",
        timeout: float = GEMINI_TIMEOUT_SECONDS,
        **kwargs: Any,
    ) -> str:
        """Run a Gemini generation with a hard timeout and safe fallback.

        Wraps ``self.model.generate_content`` in ``asyncio.to_thread`` (the SDK
        call is blocking) and bounds it with ``asyncio.wait_for``. Any timeout
        or error is logged and the provided ``fallback`` string is returned so
        a slow or failing model never hangs the user's turn.

        When ``self._stream_callback`` is set, uses Gemini streaming mode
        (``stream=True``) and forwards each text chunk through the callback in
        real-time, then returns the full concatenated text.

        Args:
            prompt: The prompt text to send to the model.
            fallback: Text returned if the call times out or errors. Callers
                typically pass "" and let their own JSON-parse fallback handle it.
            timeout: Maximum seconds to wait for the model.
            **kwargs: Extra keyword args forwarded to ``generate_content``
                (e.g. ``generation_config``).

        Returns:
            The model response text on success, otherwise ``fallback``.
        """
        if self.model is None:
            logger.error(f"[{self.name}] generate() called but no model is configured.")
            return fallback

        # If a stream callback is set, use streaming mode
        if self._stream_callback is not None:
            try:
                full_text = await asyncio.wait_for(
                    self._generate_with_streaming(prompt, **kwargs),
                    timeout=timeout,
                )
                return full_text
            except asyncio.TimeoutError:
                logger.error(f"[{self.name}] Gemini streaming generation timed out after {timeout}s.")
                return fallback
            except Exception as e:
                logger.error(f"[{self.name}] Gemini streaming generation failed: {e}", exc_info=True)
                return fallback

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(self.model.generate_content, prompt, **kwargs),
                timeout=timeout,
            )
            return response.text
        except asyncio.TimeoutError:
            logger.error(f"[{self.name}] Gemini generation timed out after {timeout}s.")
            return fallback
        except Exception as e:
            logger.error(f"[{self.name}] Gemini generation failed: {e}", exc_info=True)
            return fallback

    async def _generate_with_streaming(self, prompt: str, **kwargs: Any) -> str:
        """Internal helper: stream Gemini response and forward chunks via callback.

        Uses ``model.generate_content(prompt, stream=True)`` in a thread,
        then iterates over response chunks and calls ``_stream_callback``
        for each text chunk.

        Returns:
            The full concatenated response text.
        """
        # Get the streaming response iterator in a thread (initial call is blocking)
        response_iter = await asyncio.to_thread(
            self.model.generate_content, prompt, stream=True, **kwargs
        )

        full_text = ""

        # Iterate over chunks - each chunk.text contains the incremental text
        def _iter_chunks():
            chunks = []
            for chunk in response_iter:
                text = chunk.text if hasattr(chunk, "text") else ""
                if text:
                    chunks.append(text)
            return chunks

        chunks = await asyncio.to_thread(_iter_chunks)
        for chunk_text in chunks:
            full_text += chunk_text
            if self._stream_callback:
                await self._stream_callback(chunk_text)

        return full_text

    async def generate_stream(
        self,
        prompt: str,
        *,
        timeout: float = GEMINI_TIMEOUT_SECONDS,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Async generator that yields text chunks from Gemini streaming.

        Uses ``model.generate_content(prompt, stream=True)`` to get an iterator
        of response chunks and yields each chunk's text content.

        Args:
            prompt: The prompt text to send to the model.
            timeout: Maximum seconds to wait for the initial response.
            **kwargs: Extra keyword args forwarded to ``generate_content``.

        Yields:
            Text chunks as they arrive from the model.
        """
        if self.model is None:
            logger.error(f"[{self.name}] generate_stream() called but no model is configured.")
            return

        try:
            response_iter = await asyncio.wait_for(
                asyncio.to_thread(
                    self.model.generate_content, prompt, stream=True, **kwargs
                ),
                timeout=timeout,
            )

            def _iter_chunks():
                chunks = []
                for chunk in response_iter:
                    text = chunk.text if hasattr(chunk, "text") else ""
                    if text:
                        chunks.append(text)
                return chunks

            chunks = await asyncio.to_thread(_iter_chunks)
            for chunk_text in chunks:
                yield chunk_text

        except asyncio.TimeoutError:
            logger.error(f"[{self.name}] Gemini stream timed out after {timeout}s.")
        except Exception as e:
            logger.error(f"[{self.name}] Gemini stream failed: {e}", exc_info=True)

    async def call_mcp_tool(self, server_name: str, tool_name: str, arguments: dict) -> Any:
        """Call an MCP tool through the client.

        Args:
            server_name: Name of the MCP server to call.
            tool_name: Name of the tool to invoke.
            arguments: Tool arguments as a dictionary.

        Returns:
            The tool's return value.

        Raises:
            RuntimeError: If MCP client is not configured.
        """
        if not self.mcp_client:
            raise RuntimeError(f"Agent '{self.name}' has no MCP client configured.")
        logger.info(f"[{self.name}] Calling MCP tool: {server_name}/{tool_name}")
        try:
            return await self.mcp_client.call_tool(server_name, tool_name, arguments)
        except Exception as e:
            logger.error(f"[{self.name}] MCP tool call failed: {server_name}/{tool_name} - {e}", exc_info=True)
            raise

    def bind_tools(self, tool_definitions: dict[str, dict]) -> None:
        """Bind MCP tool definitions to this agent.

        Args:
            tool_definitions: Mapping of tool names to their schema definitions.
        """
        self._tools.update(tool_definitions)

    def get_tool_descriptions(self) -> str:
        """Get formatted tool descriptions for LLM context.

        Returns:
            A string describing all available tools.
        """
        if not self._tools:
            return "No tools available."
        descriptions = []
        for name, schema in self._tools.items():
            desc = schema.get("description", "No description")
            params = schema.get("parameters", {})
            descriptions.append(f"- {name}: {desc}\n  Parameters: {params}")
        return "\n".join(descriptions)

    def __del__(self):
        """Deregister the agent when it is garbage collected."""
        AgentRegistry.deregister(self.name)
