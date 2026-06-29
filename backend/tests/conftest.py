"""Shared fixtures for backend tests.

Provides mocks for Vertex AI Gemini, Firestore, MCP client, and auth
so all tests can run without real API keys or external services.
"""

import asyncio
import json
import uuid
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# In-memory Firestore mock
# ---------------------------------------------------------------------------


class MockDocumentSnapshot:
    """Mimics a Firestore DocumentSnapshot."""

    def __init__(self, doc_id: str, data: Optional[dict] = None):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self) -> dict:
        return dict(self._data) if self._data else {}


class MockDocumentReference:
    """Mimics a Firestore DocumentReference."""

    def __init__(self, collection_store: dict, doc_id: str, db_store: Optional[dict] = None):
        self._store = collection_store
        self.id = doc_id
        self._db_store = db_store or {}

    async def get(self) -> MockDocumentSnapshot:
        data = self._store.get(self.id)
        return MockDocumentSnapshot(self.id, data)

    async def set(self, data: dict) -> None:
        self._store[self.id] = dict(data)

    async def update(self, data: dict) -> None:
        if self.id in self._store:
            self._store[self.id].update(data)

    async def delete(self) -> None:
        self._store.pop(self.id, None)

    def collection(self, name: str) -> "MockCollectionReference":
        """Support subcollections on a document (e.g. users/{uid}/embeddings)."""
        subcoll_key = f"{self.id}/{name}"
        return MockCollectionReference(self._db_store, subcoll_key)


class MockQuery:
    """Mimics a Firestore query with where() and limit()."""

    def __init__(self, collection_store: dict, field: str, op: str, value: Any):
        self._store = collection_store
        self._field = field
        self._op = op
        self._value = value
        self._limit: Optional[int] = None

    def limit(self, count: int) -> "MockQuery":
        self._limit = count
        return self

    async def stream(self):
        results = []
        for doc_id, data in self._store.items():
            if self._op == "==" and data.get(self._field) == self._value:
                results.append(MockDocumentSnapshot(doc_id, data))
        if self._limit:
            results = results[: self._limit]
        for doc in results:
            yield doc


class MockCollectionReference:
    """Mimics a Firestore CollectionReference."""

    def __init__(self, db_store: dict, collection_name: str):
        if collection_name not in db_store:
            db_store[collection_name] = {}
        self._store = db_store[collection_name]
        self._collection_name = collection_name
        self._db_store = db_store

    def document(self, doc_id: Optional[str] = None) -> MockDocumentReference:
        if doc_id is None:
            doc_id = str(uuid.uuid4())
        return MockDocumentReference(self._store, doc_id, db_store=self._db_store)

    def where(self, field: str, op: str, value: Any) -> MockQuery:
        return MockQuery(self._store, field, op, value)

    async def stream(self):
        for doc_id, data in list(self._store.items()):
            yield MockDocumentSnapshot(doc_id, data)


class MockFirestoreClient:
    """In-memory mock that mimics the async Firestore AsyncClient."""

    def __init__(self):
        self._data: dict[str, dict] = {}

    def collection(self, name: str) -> MockCollectionReference:
        return MockCollectionReference(self._data, name)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_firestore_db():
    """Provide an in-memory mock Firestore client instance."""
    return MockFirestoreClient()


@pytest.fixture(autouse=True)
def mock_firestore(mock_firestore_db):
    """Patch Firestore get_db and init_firestore globally for all tests."""
    with patch("app.db.firestore.init_firestore", return_value=mock_firestore_db), \
         patch("app.db.firestore.get_db", return_value=mock_firestore_db), \
         patch("app.db.firestore._db", mock_firestore_db):
        yield mock_firestore_db


@pytest.fixture
def mock_gemini_response():
    """Factory to create a mock Gemini response with controlled text."""

    def _factory(text: str):
        mock_response = MagicMock()
        mock_response.text = text
        return mock_response

    return _factory


@pytest.fixture
def mock_vertexai_model(mock_gemini_response):
    """Patch vertexai.init and GenerativeModel to return controlled responses."""
    mock_model_instance = MagicMock()

    # Default response - can be overridden per test
    default_response = mock_gemini_response(json.dumps({
        "intent": "general_chat",
        "agents": [],
        "tasks": [],
        "direct_response": "Hello! How can I help you today?",
    }))
    mock_model_instance.generate_content = MagicMock(return_value=default_response)

    with patch("vertexai.init") as mock_init, \
         patch("vertexai.generative_models.GenerativeModel", return_value=mock_model_instance) as mock_model_cls:
        mock_model_cls._instance = mock_model_instance
        yield mock_model_instance


# Keep backward-compatible alias
@pytest.fixture
def mock_gemini_client(mock_vertexai_model):
    """Alias for mock_vertexai_model for backward compatibility."""
    return mock_vertexai_model


@pytest.fixture
def mock_mcp_client():
    """Provide a mock MCPClient that returns predefined tool results."""
    mock = AsyncMock()
    mock.start = AsyncMock()
    mock.stop = AsyncMock()
    mock.connect_server = AsyncMock()
    mock.disconnect_server = AsyncMock()
    mock.list_servers = MagicMock(return_value=["google-calendar", "google-tasks", "google-gmail"])
    mock.list_tools = MagicMock(return_value={})
    mock.call_tool = AsyncMock(return_value=[])
    return mock


@pytest.fixture
def test_auth_token():
    """Provide a fake auth token for testing."""
    return "test-token-123"


@pytest.fixture(autouse=True)
def mock_verify_token():
    """Patch verify_google_token to return a test user dict."""
    user_info = {
        "sub": "user123",
        "email": "test@example.com",
        "name": "Test User",
        "picture": "",
    }
    with patch("app.auth.verify_google_token", new_callable=AsyncMock, return_value=user_info) as mock:
        yield mock


@pytest.fixture(autouse=True)
def reset_embedding_model_cache():
    """Reset the module-level embedding model cache between tests."""
    import app.agents.memory as mem_module
    original = mem_module._embedding_model
    mem_module._embedding_model = None
    yield
    mem_module._embedding_model = original


@pytest.fixture
async def app_client():
    """Provide an httpx.AsyncClient connected to the FastAPI app via ASGITransport.

    Overrides the lifespan dependencies so the app starts without connecting
    to real MCP servers or Firestore.
    """
    from contextlib import asynccontextmanager

    from httpx import ASGITransport, AsyncClient

    from app.agents.base import AgentRegistry

    # Clear any existing agents from previous tests
    AgentRegistry._agents.clear()

    # Create a minimal lifespan that doesn't connect to external services
    @asynccontextmanager
    async def test_lifespan(app):
        yield

    # Import the app module and override lifespan
    from app import main as app_module

    original_lifespan = app_module.app.router.lifespan_context
    app_module.app.router.lifespan_context = test_lifespan

    transport = ASGITransport(app=app_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    # Restore original lifespan
    app_module.app.router.lifespan_context = original_lifespan
    AgentRegistry._agents.clear()
