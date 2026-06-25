"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GCP_API_KEY: str = ""  # GCP API key for Cloud TTS
    GCP_PROJECT_ID: str = ""
    GCP_REGION: str = "us-central1"

    # Firestore configuration
    FIRESTORE_PROJECT_ID: str = ""  # Defaults to GCP_PROJECT_ID if empty
    FIRESTORE_DATABASE: str = "(default)"

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # Scheduler settings
    SCHEDULER_API_KEY: str = ""
    NUDGE_INTERVAL_MINUTES: int = 30

    # MCP server paths
    MCP_CALENDAR_PATH: str = "../mcp-servers/google-calendar/server.py"
    MCP_TASKS_PATH: str = "../mcp-servers/google-tasks/server.py"
    MCP_GMAIL_PATH: str = "../mcp-servers/google-gmail/server.py"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
