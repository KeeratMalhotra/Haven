"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GCP_API_KEY: str = ""  # GCP API key for Cloud TTS
    GCP_PROJECT_ID: str = ""
    GCP_REGION: str = "us-central1"

    # Gemini model used by all agents. gemini-2.0-flash is significantly
    # faster than gemini-2.5-flash for our routing/formatting workloads.
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Firestore configuration
    FIRESTORE_PROJECT_ID: str = ""  # Defaults to GCP_PROJECT_ID if empty
    FIRESTORE_DATABASE: str = "(default)"

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        """Parse FRONTEND_ORIGIN as a comma-separated list of allowed origins."""
        raw = self.FRONTEND_ORIGIN
        origins = [o.strip() for o in raw.split(",") if o.strip()]
        return origins if origins else ["http://localhost:3000"]

    # Scheduler settings
    SCHEDULER_API_KEY: str = ""
    NUDGE_INTERVAL_MINUTES: int = 30

    # Google OAuth redirect URI for incremental service connections
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/integrations/callback"

    # Spotify OAuth credentials
    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    SPOTIFY_REDIRECT_URI: str = ""

    # MCP server paths
    MCP_CALENDAR_PATH: str = "../mcp-servers/google-calendar/server.py"
    MCP_TASKS_PATH: str = "../mcp-servers/google-tasks/server.py"
    MCP_GMAIL_PATH: str = "../mcp-servers/google-gmail/server.py"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
