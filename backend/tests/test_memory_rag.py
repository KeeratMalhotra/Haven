"""Tests for the Deep Memory RAG feature (embedding generation & semantic retrieval).

All tests rely on the autouse ``mock_firestore`` fixture (in-memory Firestore)
from conftest, so no real Firestore, Gemini, or Vertex AI access is required.
The TextEmbeddingModel is mocked to return deterministic vectors.
"""

import math
from unittest.mock import MagicMock, patch

import pytest

from app.agents.memory import (
    _cosine_similarity,
    _generate_embedding,
    _observation_text_repr,
    record_observation,
    retrieve_relevant_memories,
)
from app.db.repositories import MemoryRepository


# ---------------------------------------------------------------------------
# Helper: deterministic embedding vectors for testing
# ---------------------------------------------------------------------------

def _make_vector(seed: float, dim: int = 768) -> list[float]:
    """Create a deterministic unit-ish vector for testing.

    Each dimension is set to sin(seed * i) so different seeds produce
    vectors with different dot products.
    """
    vec = [math.sin(seed * (i + 1)) for i in range(dim)]
    mag = math.sqrt(sum(x * x for x in vec))
    if mag > 0:
        vec = [x / mag for x in vec]
    return vec


# ---------------------------------------------------------------------------
# Tests for _cosine_similarity
# ---------------------------------------------------------------------------


class TestCosineSimilarity:
    """Unit tests for the cosine similarity helper."""

    def test_identical_vectors(self):
        """Identical vectors should have similarity ~1.0."""
        v = _make_vector(1.0)
        assert abs(_cosine_similarity(v, v) - 1.0) < 1e-6

    def test_orthogonal_vectors(self):
        """Orthogonal vectors should have similarity ~0.0."""
        # Simple 3-d orthogonal example
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        assert abs(_cosine_similarity(a, b)) < 1e-6

    def test_opposite_vectors(self):
        """Opposite vectors should have similarity ~-1.0."""
        a = [1.0, 0.0, 0.0]
        b = [-1.0, 0.0, 0.0]
        assert abs(_cosine_similarity(a, b) + 1.0) < 1e-6

    def test_zero_vector_returns_zero(self):
        """Zero-magnitude vector should return 0.0."""
        a = [0.0, 0.0, 0.0]
        b = [1.0, 2.0, 3.0]
        assert _cosine_similarity(a, b) == 0.0

    def test_different_lengths_returns_zero(self):
        """Vectors of different lengths should return 0.0."""
        a = [1.0, 2.0]
        b = [1.0, 2.0, 3.0]
        assert _cosine_similarity(a, b) == 0.0


# ---------------------------------------------------------------------------
# Tests for _observation_text_repr
# ---------------------------------------------------------------------------


class TestObservationTextRepr:
    """Unit tests for the observation text representation builder."""

    def test_full_observation(self):
        obs = {"type": "task_completed", "title": "finish report", "hour": 10}
        result = _observation_text_repr(obs)
        assert "task_completed" in result
        assert "finish report" in result
        assert "10h" in result

    def test_no_title(self):
        obs = {"type": "focus_session", "hour": 9}
        result = _observation_text_repr(obs)
        assert "focus_session" in result
        assert "9h" in result

    def test_no_hour(self):
        obs = {"type": "task_created", "title": "buy milk"}
        result = _observation_text_repr(obs)
        assert "task_created" in result
        assert "buy milk" in result


# ---------------------------------------------------------------------------
# Tests for _generate_embedding
# ---------------------------------------------------------------------------


class TestGenerateEmbedding:
    """Tests for the embedding generation helper (mocked)."""

    @patch("app.agents.memory.TextEmbeddingModel", create=True)
    async def test_successful_embedding(self, mock_model_cls):
        """Successful embedding returns a list of floats."""
        # We need to patch where it's actually imported in the function
        mock_embedding = MagicMock()
        mock_embedding.values = _make_vector(1.0)
        mock_model_instance = MagicMock()
        mock_model_instance.get_embeddings.return_value = [mock_embedding]

        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            return_value=mock_model_instance,
        ):
            result = await _generate_embedding("test text")
            assert result is not None
            assert len(result) == 768
            assert isinstance(result[0], float)

    @patch(
        "vertexai.language_models.TextEmbeddingModel.from_pretrained",
        side_effect=Exception("API unavailable"),
    )
    async def test_embedding_failure_returns_none(self, mock_from_pretrained):
        """On failure, returns None (graceful degradation)."""
        result = await _generate_embedding("test text")
        assert result is None


# ---------------------------------------------------------------------------
# Tests for record_observation with embedding
# ---------------------------------------------------------------------------


class TestRecordObservationEmbedding:
    """Tests that record_observation attempts embedding and stores it."""

    async def test_embedding_stored_on_success(self):
        """When embedding succeeds, observation has 'embedding' field."""
        fake_vector = _make_vector(2.0)
        mock_embedding = MagicMock()
        mock_embedding.values = fake_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            return_value=mock_model,
        ):
            memory = await record_observation(
                "embed_user",
                "task_completed",
                {"hour": 10, "title": "finish report"},
            )

        assert memory is not None
        obs = memory.observations[-1]
        assert "embedding" in obs
        assert len(obs["embedding"]) == 768

    async def test_observation_stored_without_embedding_on_failure(self):
        """When embedding fails, observation is still stored (no embedding field)."""
        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            side_effect=Exception("API error"),
        ):
            memory = await record_observation(
                "no_embed_user",
                "task_completed",
                {"hour": 14, "title": "review PR"},
            )

        assert memory is not None
        obs = memory.observations[-1]
        assert "embedding" not in obs
        # The observation itself is still correctly stored
        assert obs["type"] == "task_completed"
        assert obs["title"] == "review PR"

    async def test_existing_tests_still_pass_with_embedding_mock(self):
        """Embedding failure does not block deterministic stats recomputation."""
        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            side_effect=Exception("offline"),
        ):
            for h in (9, 9, 10):
                await record_observation(
                    "stats_user",
                    "task_completed",
                    {"hour": h, "title": "work", "estimated_minutes": 60, "actual_minutes": 60},
                )

        memory = await MemoryRepository.get_memory("stats_user")
        assert memory.behavioral_stats.tasks_completed == 3
        assert 9 in memory.productive_hours


# ---------------------------------------------------------------------------
# Tests for retrieve_relevant_memories
# ---------------------------------------------------------------------------


class TestRetrieveRelevantMemories:
    """Tests for the semantic retrieval function."""

    async def test_returns_ranked_results(self):
        """Results are ordered by cosine similarity (most relevant first)."""
        # Seed observations with different embeddings
        vec_report = _make_vector(1.0)
        vec_gym = _make_vector(5.0)
        vec_meeting = _make_vector(3.0)

        # Store observations directly with embeddings
        await MemoryRepository.record_observation("rag_user", {
            "type": "task_completed", "title": "finish quarterly report", "hour": 10,
            "embedding": vec_report,
        })
        await MemoryRepository.record_observation("rag_user", {
            "type": "focus_session", "title": "gym workout", "hour": 7,
            "embedding": vec_gym,
        })
        await MemoryRepository.record_observation("rag_user", {
            "type": "task_completed", "title": "team meeting", "hour": 14,
            "embedding": vec_meeting,
        })

        # The query embedding should be closest to vec_report (seed 1.0)
        query_vector = _make_vector(1.1)  # Very close to seed 1.0

        mock_embedding = MagicMock()
        mock_embedding.values = query_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("rag_user", "report deadline")

        assert len(results) > 0
        # The report observation should be ranked first (highest similarity)
        assert "quarterly report" in results[0]

    async def test_returns_empty_on_query_embedding_failure(self):
        """Returns empty list when query embedding fails."""
        # Store an observation with embedding
        await MemoryRepository.record_observation("rag_fail_user", {
            "type": "task_completed", "title": "something", "hour": 9,
            "embedding": _make_vector(1.0),
        })

        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            side_effect=Exception("API error"),
        ):
            results = await retrieve_relevant_memories("rag_fail_user", "anything")

        assert results == []

    async def test_returns_empty_for_user_with_no_embeddings(self):
        """Returns empty list when no observations have embeddings."""
        # Store observation WITHOUT embedding
        await MemoryRepository.record_observation("no_vec_user", {
            "type": "task_completed", "title": "old task", "hour": 11,
        })

        query_vector = _make_vector(1.0)
        mock_embedding = MagicMock()
        mock_embedding.values = query_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("no_vec_user", "anything")

        assert results == []

    async def test_returns_empty_for_nonexistent_user(self):
        """Returns empty list for a user that does not exist."""
        query_vector = _make_vector(1.0)
        mock_embedding = MagicMock()
        mock_embedding.values = query_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("ghost_user", "anything")

        assert results == []

    async def test_top_k_limits_results(self):
        """Only returns up to top_k results."""
        # Store 10 observations with embeddings
        for i in range(10):
            await MemoryRepository.record_observation("topk_user", {
                "type": "task_completed", "title": f"task_{i}", "hour": i % 24,
                "embedding": _make_vector(float(i)),
            })

        query_vector = _make_vector(0.5)
        mock_embedding = MagicMock()
        mock_embedding.values = query_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "vertexai.language_models.TextEmbeddingModel.from_pretrained",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("topk_user", "test", top_k=3)

        assert len(results) <= 3

    async def test_empty_query_returns_empty(self):
        """Empty query string returns empty list immediately."""
        results = await retrieve_relevant_memories("any_user", "")
        assert results == []

    async def test_empty_user_id_returns_empty(self):
        """Empty user_id returns empty list immediately."""
        results = await retrieve_relevant_memories("", "some query")
        assert results == []


# ---------------------------------------------------------------------------
# Tests for base agent _format_relevant_memories
# ---------------------------------------------------------------------------


class TestFormatRelevantMemories:
    """Tests for the AgentBase._format_relevant_memories helper."""

    def test_formats_memories_when_present(self):
        """Memories are formatted into a prompt-ready string."""
        from app.agents.base import AgentBase

        # Create a concrete subclass for testing
        class TestAgent(AgentBase):
            name = "test_agent"
            async def execute(self, task: dict) -> dict:
                return {}

        agent = TestAgent()
        task = {"relevant_memories": ["pattern A", "pattern B"]}
        result = agent._format_relevant_memories(task)
        assert "Haven remembers" in result
        assert "pattern A" in result
        assert "pattern B" in result

    def test_returns_empty_when_no_memories(self):
        """Returns empty string when no memories in task."""
        from app.agents.base import AgentBase

        class TestAgent(AgentBase):
            name = "test_agent_2"
            async def execute(self, task: dict) -> dict:
                return {}

        agent = TestAgent()
        task = {"message": "hello"}
        result = agent._format_relevant_memories(task)
        assert result == ""

    def test_returns_empty_for_empty_list(self):
        """Returns empty string for empty memories list."""
        from app.agents.base import AgentBase

        class TestAgent(AgentBase):
            name = "test_agent_3"
            async def execute(self, task: dict) -> dict:
                return {}

        agent = TestAgent()
        task = {"relevant_memories": []}
        result = agent._format_relevant_memories(task)
        assert result == ""
