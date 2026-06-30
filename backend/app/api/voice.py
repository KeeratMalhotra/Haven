"""Voice API router - server-side Speech-to-Text (STT).

Provides a REST endpoint that transcribes recorded audio using the Google
Cloud Speech-to-Text REST API. Doing STT server-side removes the dependency
on the browser Web Speech API (``webkitSpeechRecognition``), which relies on
Google's private speech endpoint and throws "network" errors on non-Chrome
browsers (Brave, Arc, Electron, etc.).

The frontend records microphone audio with MediaRecorder (default
``audio/webm;codecs=opus``), base64-encodes it, and POSTs it here. We forward
it to Google Cloud Speech-to-Text and return the transcript.

Authentication mirrors the rest of the app: a Google OAuth token may be
provided via the ``auth_token`` body field or the ``Authorization`` header.
When a token is supplied it is verified; this keeps parity with the WebSocket
chat flow (which also tolerates anonymous use in local development).
"""

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from app.auth import verify_google_token
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

# Google Cloud Speech-to-Text REST endpoint (synchronous recognition).
STT_URL = "https://speech.googleapis.com/v1/speech:recognize"


class TranscribeRequest(BaseModel):
    """Request body for speech-to-text transcription.

    Attributes:
        audio_base64: Base64-encoded audio bytes captured by the browser.
        encoding: Google STT audio encoding. Defaults to ``WEBM_OPUS`` which
            matches MediaRecorder's default ``audio/webm;codecs=opus`` output.
        sample_rate: Optional sample rate in Hertz. For ``WEBM_OPUS`` Google
            reads the rate from the stream header, so this is optional and only
            sent when > 0.
        language: BCP-47 language code (default ``en-US``).
        auth_token: Optional Google OAuth token (also accepted via header).
    """

    audio_base64: str
    encoding: str = "WEBM_OPUS"
    sample_rate: int = 0
    language: str = "en-US"
    auth_token: str = ""


class TranscribeResponse(BaseModel):
    """Response body containing the recognized transcript."""

    transcript: str
    confidence: float = 0.0


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    body: TranscribeRequest,
    authorization: Optional[str] = Header(default=None),
) -> TranscribeResponse:
    """Transcribe recorded audio to text via Google Cloud Speech-to-Text.

    Args:
        body: The transcription request (base64 audio + recognition config).
        authorization: Optional bearer token header (fallback to body token).

    Returns:
        TranscribeResponse with the best transcript and its confidence.

    Raises:
        HTTPException: 400 if no audio is provided, 401 if an invalid token is
            supplied, 503 if the STT service is unreachable or misconfigured.
    """
    if not body.audio_base64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio provided for transcription.",
        )

    # Verify the token only when one is supplied, mirroring the WebSocket flow
    # which permits anonymous use in local development. An explicitly supplied
    # but invalid token is rejected.
    token = body.auth_token
    if not token and authorization:
        token = (
            authorization[7:]
            if authorization.startswith("Bearer ")
            else authorization
        )
    if token:
        await verify_google_token(token)

    if not settings.GCP_API_KEY:
        logger.error("[voice] GCP_API_KEY is not configured; STT unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech-to-text is not configured on the server.",
        )

    recognition_config: dict = {
        "encoding": body.encoding,
        "languageCode": body.language,
        "enableAutomaticPunctuation": True,
        "model": "latest_short",
    }
    # sampleRateHertz is optional for WEBM_OPUS (read from the header). Only
    # include it when the client explicitly provides a positive value so we
    # don't trigger a sample-rate-mismatch error.
    if body.sample_rate and body.sample_rate > 0:
        recognition_config["sampleRateHertz"] = body.sample_rate

    request_body = {
        "config": recognition_config,
        "audio": {"content": body.audio_base64},
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                STT_URL,
                json=request_body,
                params={"key": settings.GCP_API_KEY},
                timeout=30.0,
            )
            response.raise_for_status()
            result = response.json()
    except httpx.HTTPStatusError as e:
        # Surface a clean, non-leaking error; log details server-side.
        logger.error(
            "[voice] Speech-to-Text API error: %s - %s",
            e.response.status_code,
            e.response.text[:500],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Speech recognition failed. Please try again.",
        )
    except httpx.HTTPError as e:
        logger.error("[voice] Speech-to-Text request failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech recognition service is unavailable.",
        )

    # Google returns a list of results, each with ranked alternatives. We join
    # the top alternative of each result to form the full transcript.
    results = result.get("results", []) or []
    transcript_parts: list[str] = []
    top_confidence = 0.0
    for res in results:
        alternatives = res.get("alternatives", []) or []
        if alternatives:
            best = alternatives[0]
            transcript_parts.append(best.get("transcript", ""))
            # Capture the confidence of the first result as representative.
            if not top_confidence:
                top_confidence = float(best.get("confidence", 0.0) or 0.0)

    transcript = " ".join(p.strip() for p in transcript_parts if p).strip()

    return TranscribeResponse(transcript=transcript, confidence=top_confidence)
