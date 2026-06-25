"""Voice Agent - Text-to-Speech synthesis.

Uses Google Cloud Text-to-Speech API for converting text to speech,
returning base64-encoded audio for the frontend to play.
"""

import base64
import json
from typing import Any

import httpx

from app.agents.base import AgentBase
from app.config import settings


class VoiceAgent(AgentBase):
    """Voice agent for text-to-speech synthesis.

    Uses the Google Cloud Text-to-Speech REST API to convert text into
    audio, returning base64-encoded audio buffer for frontend playback.
    """

    name = "voice"
    description = "Converts text to speech audio"
    capabilities = ["text_to_speech", "audio_generation"]

    # Google Cloud TTS REST endpoint
    TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

    def __init__(self, mcp_client: Any = None):
        """Initialize the voice agent.

        Args:
            mcp_client: Optional MCP client (not typically needed for voice).
        """
        super().__init__(mcp_client)

    async def execute(self, task: dict) -> dict:
        """Convert text to speech audio.

        Args:
            task: Dict with 'message' (text to synthesize),
                  optional 'voice' (voice name) and 'language' (language code).

        Returns:
            Dict with 'content' (base64 audio), 'agent' name,
            and 'audio_format' (encoding type).
        """
        text = task.get("message", "")
        voice_name = task.get("voice", "en-US-Journey-F")
        language_code = task.get("language", "en-US")

        if not text:
            return {
                "content": "",
                "agent": self.name,
                "audio_format": "mp3",
                "error": "No text provided for synthesis",
            }

        audio_content = await self._synthesize_speech(
            text, voice_name, language_code
        )

        return {
            "content": audio_content,
            "agent": self.name,
            "audio_format": "mp3",
        }

    async def _synthesize_speech(
        self, text: str, voice_name: str, language_code: str
    ) -> str:
        """Call Google Cloud TTS API to synthesize speech.

        Args:
            text: The text to convert to speech.
            voice_name: The Google TTS voice name.
            language_code: The language code (e.g., "en-US").

        Returns:
            Base64-encoded audio content string.
        """
        request_body = {
            "input": {"text": text},
            "voice": {
                "languageCode": language_code,
                "name": voice_name,
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": 1.0,
                "pitch": 0.0,
            },
        }

        try:
            async with httpx.AsyncClient() as client:
                # Use GCP_API_KEY for Cloud TTS; fall back to GEMINI_API_KEY if not set
                api_key = settings.GCP_API_KEY or settings.GEMINI_API_KEY
                response = await client.post(
                    self.TTS_URL,
                    json=request_body,
                    params={"key": api_key},
                    timeout=30.0,
                )
                response.raise_for_status()
                result = response.json()
                return result.get("audioContent", "")
        except httpx.HTTPError as e:
            # Fallback: return empty audio on API failure
            # In production, this would be logged and handled properly
            return ""
        except Exception:
            return ""
