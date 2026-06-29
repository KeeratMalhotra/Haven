"""Tests for the Deep Memory RAG feature (embedding generation & semantic retrieval).

All tests rely on the autouse ``mock_firestore`` fixture (in-memory Firestore)
from conftest, so no real Firestore, Gemini, or Vertex AI access is required.
The TextEmbeddingModel is mocked to return deterministic vectors.

Architecture:
- Embeddings are stored in a Firestore subcollection ``users/{user_id}/embeddings``
  (one document per observation) to avoid exceeding the 1 MiB document limit.
- The embedding model is cached at module level (_get_embedding_model).
- record_observation fires-and-forgets embedding generation asynchronously.
- retrieve_relevant_memories fetches from the subcollection and applies a
  minimum cosine similarity threshold (0.3) before returning results.
"""

import asyncio
import math
from unittest.mock import MagicMock, patch

import pytest

from app.agents.memory import (
    _SIMILARITY_THRESHOLD,
    _cosine_similarity,
    _generate_embedding,
    _observation_text_repr,
    _store_embedding_in_subcollection,
    record_observation,
    retrieve_relevant_memories,
)
from app.db.repositories import MemoryRepository


# ---------------------------------------------------------------------------
# Helper: deterministic embedding vectors for testing
# ---------------------------------------------------------------------------

def _make_vector(seed: float, dim: int = 768) -> list[float]:
    """Create a deterministic unit vector for testing.

    Each dimension is set to sin(seed * i) so different seeds produce
    vectors with different dot products.
    """
    vec = [math.sin(seed * (i + 1)) for i in range(dim)]
    mag = math.sqrt(sum(x * x for x in vec))
    if mag > 0:
        vec = [x / mag for x in vec]
    return vec


def _make_similar_vector(base: list[float], similarity: float = 0.9) -> list[float]:
    """Create a vector with approximately the target cosine similarity to base.

    Uses the formula: result = similarity * base + sqrt(1 - sim^2) * orthogonal
    where orthogonal is derived from a fixed seed.
    """
    import random
    dim = len(base)
    rng = random.Random(42)
    noise = [rng.gauss(0, 1) for _ in range(dim)]
    # Orthogonalize noise against base
    dot_nb = sum(n * b for n, b in zip(noise, base))
    noise = [n - dot_nb * b for n, b in zip(noise, base)]
    noise_mag = math.sqrt(sum(x * x for x in noise))
    if noise_mag > 0:
        noise = [x / noise_mag for x in noise]
    # Combine
    scale = math.sqrt(max(0, 1 - similarity * similarity))
    vec = [similarity * b + scale * n for b, n in zip(base, noise)]
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

    @patch("app.agents.memory._embedding_model", None)
    async def test_successful_embedding(self):
        """Successful embedding returns a list of floats."""
        mock_embedding = MagicMock()
        mock_embedding.values = _make_vector(1.0)
        mock_model_instance = MagicMock()
        mock_model_instance.get_embeddings.return_value = [mock_embedding]

        with patch(
            "app.agents.memory._get_embedding_model",
            return_value=mock_model_instance,
        ):
            result = await _generate_embedding("test text")
            assert result is not None
            assert len(result) == 768
            assert isinstance(result[0], float)

    @patch("app.agents.memory._embedding_model", None)
    async def test_embedding_failure_returns_none(self):
        """On failure, returns None (graceful degradation)."""
        with patch(
            "app.agents.memory._get_embedding_model",
            side_effect=Exception("API unavailable"),
        ):
            result = await _generate_embedding("test text")
            assert result is None


# ---------------------------------------------------------------------------
# Tests for _store_embedding_in_subcollection
# ---------------------------------------------------------------------------


class TestStoreEmbeddingSubcollection:
    """Tests that embeddings are stored in the subcollection."""

    async def test_stores_embedding_document(self, mock_firestore_db):
        """Embedding is stored in users/{uid}/embeddings subcollection."""
        vec = _make_vector(1.0)
        await _store_embedding_in_subcollection(
            "sub_user", 0, vec, "task_completed: finish report at 10h"
        )

        # Verify data is in the subcollection
        subcoll_key = "sub_user/embeddings"
        assert subcoll_key in mock_firestore_db._data
        docs = mock_firestore_db._data[subcoll_key]
        assert len(docs) == 1
        doc_data = list(docs.values())[0]
        assert doc_data["observation_index"] == 0
        assert doc_data["embedding"] == vec
        assert doc_data["text_repr"] == "task_completed: finish report at 10h"


# ---------------------------------------------------------------------------
# Tests for record_observation with embedding (fire-and-forget)
# ---------------------------------------------------------------------------


class TestRecordObservationEmbedding:
    """Tests that record_observation stores observations and fires off embedding."""

    async def test_observation_stored_without_inline_embedding(self):
        """Observations in the main document never contain inline embeddings."""
        fake_vector = _make_vector(2.0)
        mock_embedding = MagicMock()
        mock_embedding.values = fake_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "app.agents.memory._get_embedding_model",
            return_value=mock_model,
        ):
            memory = await record_observation(
                "embed_user",
                "task_completed",
                {"hour": 10, "title": "finish report"},
            )
            # Allow the fire-and-forget task to complete
            await asyncio.sleep(0.05)

        assert memory is not None
        obs = memory.observations[-1]
        # Embedding must NOT be stored inline (fixes Firestore 1 MiB limit)
        assert "embedding" not in obs
        assert obs["type"] == "task_completed"
        assert obs["title"] == "finish report"

    async def test_embedding_stored_in_subcollection(self, mock_firestore_db):
        """Fire-and-forget stores embedding in subcollection."""
        fake_vector = _make_vector(2.0)
        mock_embedding = MagicMock()
        mock_embedding.values = fake_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "app.agents.memory._get_embedding_model",
            return_value=mock_model,
        ):
            await record_observation(
                "embed_sub_user",
                "task_completed",
                {"hour": 10, "title": "finish report"},
            )
            # Allow the fire-and-forget task to complete
            await asyncio.sleep(0.05)

        # Verify embedding landed in the subcollection
        subcoll_key = "embed_sub_user/embeddings"
        assert subcoll_key in mock_firestore_db._data
        docs = mock_firestore_db._data[subcoll_key]
        assert len(docs) == 1
        doc_data = list(docs.values())[0]
        assert doc_data["embedding"] == fake_vector
        assert "task_completed" in doc_data["text_repr"]

    async def test_observation_stored_without_embedding_on_failure(self):
        """When embedding fails, observation is still stored (no embedding)."""
        with patch(
            "app.agents.memory._get_embedding_model",
            side_effect=Exception("API error"),
        ):
            memory = await record_observation(
                "no_embed_user",
                "task_completed",
                {"hour": 14, "title": "review PR"},
            )
            await asyncio.sleep(0.05)

        assert memory is not None
        obs = memory.observations[-1]
        assert "embedding" not in obs
        # The observation itself is still correctly stored
        assert obs["type"] == "task_completed"
        assert obs["title"] == "review PR"

    async def test_existing_tests_still_pass_with_embedding_mock(self):
        """Embedding failure does not block deterministic stats recomputation."""
        with patch(
            "app.agents.memory._get_embedding_model",
            side_effect=Exception("offline"),
        ):
            for h in (9, 9, 10):
                await record_observation(
                    "stats_user",
                    "task_completed",
                    {"hour": h, "title": "work", "estimated_minutes": 60, "actual_minutes": 60},
                )
            await asyncio.sleep(0.05)

        memory = await MemoryRepository.get_memory("stats_user")
        assert memory.behavioral_stats.tasks_completed == 3
        assert 9 in memory.productive_hours


# ---------------------------------------------------------------------------
# Tests for retrieve_relevant_memories
# ---------------------------------------------------------------------------


class TestRetrieveRelevantMemories:
    """Tests for the semantic retrieval function (reads from subcollection)."""

    async def test_returns_ranked_results(self, mock_firestore_db):
        """Results are ordered by cosine similarity (most relevant first)."""
        # Create a base query vector and vectors with known similarities
        query_vector = _make_vector(1.0)
        # High similarity to query (should rank first)
        vec_report = _make_similar_vector(query_vector, similarity=0.9)
        # Medium similarity (should rank second)
        vec_meeting = _make_similar_vector(query_vector, similarity=0.5)
        # Low similarity but still above threshold
        vec_gym = _make_similar_vector(query_vector, similarity=0.35)

        await _store_embedding_in_subcollection(
            "rag_user", 0, vec_report, "task_completed: finish quarterly report at 10h"
        )
        await _store_embedding_in_subcollection(
            "rag_user", 1, vec_gym, "focus_session: gym workout at 7h"
        )
        await _store_embedding_in_subcollection(
            "rag_user", 2, vec_meeting, "task_completed: team meeting at 14h"
        )

        mock_embedding = MagicMock()
        mock_embedding.values = query_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "app.agents.memory._get_embedding_model",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("rag_user", "report deadline")

        assert len(results) > 0
        # The report observation should be ranked first (highest similarity)
        assert "quarterly report" in results[0]

    async def test_returns_empty_on_query_embedding_failure(self, mock_firestore_db):
        """Returns empty list when query embedding fails."""
        await _store_embedding_in_subcollection(
            "rag_fail_user", 0, _make_vector(1.0), "task_completed: something at 9h"
        )

        with patch(
            "app.agents.memory._get_embedding_model",
            side_effect=Exception("API error"),
        ):
            results = await retrieve_relevant_memories("rag_fail_user", "anything")

        assert results == []

    async def test_returns_empty_for_user_with_no_embeddings(self, mock_firestore_db):
        """Returns empty list when no embeddings exist in subcollection."""
        # Store observation WITHOUT embedding in subcollection (just main doc)
        await MemoryRepository.record_observation("no_vec_user", {
            "type": "task_completed", "title": "old task", "hour": 11,
        })

        query_vector = _make_vector(1.0)
        mock_embedding = MagicMock()
        mock_embedding.values = query_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "app.agents.memory._get_embedding_model",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("no_vec_user", "anything")

        assert results == []

    async def test_returns_empty_for_nonexistent_user(self, mock_firestore_db):
        """Returns empty list for a user that has no embeddings subcollection."""
        query_vector = _make_vector(1.0)
        mock_embedding = MagicMock()
        mock_embedding.values = query_vector
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "app.agents.memory._get_embedding_model",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("ghost_user", "anything")

        assert results == []

    async def test_top_k_limits_results(self, mock_firestore_db):
        """Only returns up to top_k results."""
        # Store 10 embeddings all with high similarity to the query
        query_vector = _make_vector(1.0)
        for i in range(10):
            # All vectors are identical to the query (sim = 1.0)
            await _store_embedding_in_subcollection(
                "topk_user", i, query_vector, f"task_completed: task_{i}"
            )

        mock_embedding = MagicMock()
        mock_embedding.values = query_vector  # Identical = sim 1.0
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "app.agents.memory._get_embedding_model",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("topk_user", "test", top_k=3)

        assert len(results) == 3

    async def test_similarity_threshold_filters_low_relevance(self, mock_firestore_db):
        """Results below the similarity threshold are excluded."""
        # Create a vector that is nearly orthogonal to the query vector
        # For high-dimensional vectors, random-ish seeds produce low similarity
        query_vec = _make_vector(1.0)
        # Use a very different seed for an unrelated vector
        unrelated_vec = _make_vector(100.0)

        # Verify the similarity is below threshold
        sim = _cosine_similarity(query_vec, unrelated_vec)
        assert sim < _SIMILARITY_THRESHOLD, (
            f"Test setup error: sim={sim} should be < {_SIMILARITY_THRESHOLD}"
        )

        await _store_embedding_in_subcollection(
            "threshold_user", 0, unrelated_vec, "focus_session: unrelated thing"
        )

        mock_embedding = MagicMock()
        mock_embedding.values = query_vec
        mock_model = MagicMock()
        mock_model.get_embeddings.return_value = [mock_embedding]

        with patch(
            "app.agents.memory._get_embedding_model",
            return_value=mock_model,
        ):
            results = await retrieve_relevant_memories("threshold_user", "query")

        # Low-similarity result should be filtered out
        assert results == []

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
