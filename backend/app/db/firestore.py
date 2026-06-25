"""Async Firestore client initialization.

Provides a singleton AsyncClient using the google-cloud-firestore SDK.
Project ID is resolved from settings.FIRESTORE_PROJECT_ID, falling back
to settings.GCP_PROJECT_ID if empty.
"""

from google.cloud.firestore_v1 import AsyncClient

from app.config import settings

_db: AsyncClient | None = None


def _resolve_project_id() -> str:
    """Resolve the Firestore project ID from settings.

    Returns:
        The project ID string, preferring FIRESTORE_PROJECT_ID,
        falling back to GCP_PROJECT_ID.
    """
    return settings.FIRESTORE_PROJECT_ID or settings.GCP_PROJECT_ID


def init_firestore() -> AsyncClient:
    """Initialize the Firestore async client singleton.

    Creates and caches the AsyncClient instance. Safe to call multiple
    times; subsequent calls return the existing client.

    Returns:
        The initialized AsyncClient instance.
    """
    global _db
    if _db is None:
        project = _resolve_project_id()
        database = settings.FIRESTORE_DATABASE or "(default)"
        _db = AsyncClient(project=project or None, database=database)
    return _db


def get_db() -> AsyncClient:
    """Return the Firestore async client singleton.

    Initializes the client on first call if not already initialized.

    Returns:
        The AsyncClient instance.
    """
    if _db is None:
        return init_firestore()
    return _db
