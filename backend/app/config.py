"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GEMINI_API_KEY: str = ""
    GCP_API_KEY: str = ""  # Separate GCP API key for Cloud TTS (falls back to GEMINI_API_KEY)
    GCP_PROJECT_ID: str = ""

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # MCP server paths
    MCP_CALENDAR_PATH: str = "../mcp-servers/google-calendar/server.py"
    MCP_TASKS_PATH: str = "../mcp-servers/google-tasks/server.py"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
