"""OAuth integration endpoints for incremental Google service scopes and Spotify."""

import hashlib
import hmac
import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from app.auth import verify_google_token
from app.config import settings
from app.db.firestore import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

# Spotify OAuth endpoints
SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"

# Token revocation endpoints
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"

# Scope mappings for each Google service
SERVICE_SCOPES: dict[str, list[str]] = {
    "calendar": ["https://www.googleapis.com/auth/calendar"],
    "tasks": ["https://www.googleapis.com/auth/tasks"],
    "gmail": [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
    ],
    "slides": [
        "https://www.googleapis.com/auth/presentations",
        "https://www.googleapis.com/auth/drive.file",
    ],
}

# Broader scopes that satisfy a service's requirements. For example,
# gmail.modify is a superset of gmail.readonly + gmail.send.
_SCOPE_EQUIVALENTS: dict[str, list[str]] = {
    "https://www.googleapis.com/auth/gmail.readonly": [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/mail.google.com",
    ],
    "https://www.googleapis.com/auth/gmail.send": [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/mail.google.com",
    ],
}


def _scope_satisfied(required: str, granted: set[str]) -> bool:
    """Check if a required scope is satisfied by the granted scopes.

    A scope is satisfied if it's directly present OR if a broader equivalent
    scope is granted (e.g. gmail.modify covers gmail.readonly).
    """
    if required in granted:
        return True
    for equivalent in _SCOPE_EQUIVALENTS.get(required, []):
        if equivalent in granted:
            return True
    return False


def _generate_state(user_id: str, service: str) -> str:
    """Generate a signed OAuth state parameter with a random nonce for CSRF protection.

    The state is formatted as: {user_id}:{service}:{nonce}:{signature}
    The signature is an HMAC-SHA256 of {user_id}:{service}:{nonce} using
    GOOGLE_CLIENT_SECRET as the signing key.
    """
    nonce = secrets.token_urlsafe(16)
    payload = f"{user_id}:{service}:{nonce}"
    signature = hmac.new(
        settings.GOOGLE_CLIENT_SECRET.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{signature}"


def _verify_state(state: str) -> tuple[str, str]:
    """Verify the signed OAuth state parameter and return (user_id, service).

    Raises HTTPException if the state is invalid or signature doesn't match.
    """
    parts = state.rsplit(":", 1)
    if len(parts) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter format",
        )

    payload, provided_signature = parts

    # Verify HMAC signature
    expected_signature = hmac.new(
        settings.GOOGLE_CLIENT_SECRET.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(provided_signature, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state signature - possible CSRF attack",
        )

    # Parse payload: user_id:service:nonce
    payload_parts = payload.split(":", 2)
    if len(payload_parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state payload format",
        )

    user_id, service, _nonce = payload_parts
    return user_id, service


@router.get("/connect/{service}")
async def connect_service(service: str, auth_token: str = Query(...)):
    """Generate a Google OAuth URL for connecting a specific service.

    Args:
        service: The service to connect (calendar, tasks, gmail, slides).
        auth_token: Google OAuth token for user identification.

    Returns:
        Dict with auth_url for the OAuth consent screen.
    """
    if service not in SERVICE_SCOPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown service: {service}. Must be one of: {', '.join(SERVICE_SCOPES.keys())}",
        )

    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    scopes = SERVICE_SCOPES[service]

    # Generate a signed state parameter with CSRF nonce
    signed_state = _generate_state(user_id, service)

    # Get the user's email to force the correct account in the consent screen
    user_email = user.get("email", "")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "prompt": "consent",
        "state": signed_state,
        "login_hint": user_email,
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(code: str = Query(...), state: str = Query(...)):
    """Handle Google OAuth callback after user grants consent.

    Exchanges the authorization code for tokens and stores them
    in the user's connected_services in Firestore.

    Args:
        code: The authorization code from Google.
        state: The state parameter containing user_id:service.

    Returns:
        Redirects to the frontend settings page.
    """
    # Verify signed state parameter (CSRF protection)
    user_id, service = _verify_state(state)

    if service not in SERVICE_SCOPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown service in state: {service}",
        )

    # Exchange authorization code for tokens
    token_data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=token_data)

    if response.status_code != 200:
        logger.error(f"Token exchange failed: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange authorization code for tokens",
        )

    tokens = response.json()

    # Store tokens and scopes in Firestore
    db = get_db()
    user_ref = db.collection("users").document(user_id)

    service_data = {
        "access_token": tokens.get("access_token", ""),
        "refresh_token": tokens.get("refresh_token", ""),
        "token_type": tokens.get("token_type", "Bearer"),
        "expires_in": tokens.get("expires_in", 0),
        "scopes": SERVICE_SCOPES[service],
        "connected": True,
    }

    await user_ref.set(
        {f"connected_services.{service}": service_data},
        merge=True,
    )

    # Return a small HTML page that notifies the parent window and closes the popup
    from fastapi.responses import HTMLResponse
    html_content = f"""<!DOCTYPE html>
<html>
<head><title>Connected</title></head>
<body>
<script>
  if (window.opener) {{
    window.opener.postMessage({{ type: "oauth-connected", service: "{service}" }}, "*");
    window.close();
  }} else {{
    window.location.href = "{settings.FRONTEND_ORIGIN}/dashboard/settings?connected={service}";
  }}
</script>
<p>Connected {service} successfully. This window should close automatically.</p>
<p>If it doesn't, <a href="{settings.FRONTEND_ORIGIN}/dashboard/settings">click here</a> to return.</p>
</body>
</html>"""
    return HTMLResponse(content=html_content)


@router.delete("/disconnect/{service}")
async def disconnect_service(service: str, auth_token: str = Query(...)):
    """Disconnect a specific Google service by removing it from connected_services.

    Args:
        service: The service to disconnect (calendar, tasks, gmail, slides).
        auth_token: Google OAuth token for user identification.

    Returns:
        Status indicating disconnection success.
    """
    if service not in SERVICE_SCOPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown service: {service}. Must be one of: {', '.join(SERVICE_SCOPES.keys())}",
        )

    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    db = get_db()
    user_ref = db.collection("users").document(user_id)

    # Get current user data to update connected_services
    doc = await user_ref.get()
    if doc.exists:
        data = doc.to_dict() or {}
        connected_services = data.get("connected_services", {})
        if service in connected_services:
            # Attempt to revoke the token at Google before removing locally
            access_token = connected_services[service].get("access_token", "")
            if access_token:
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            GOOGLE_REVOKE_URL,
                            params={"token": access_token},
                            headers={"Content-Type": "application/x-www-form-urlencoded"},
                        )
                except Exception:
                    # If revocation fails (network, already expired), proceed anyway
                    logger.warning(f"Token revocation failed for service {service}, user {user_id}")

            del connected_services[service]
            await user_ref.update({"connected_services": connected_services})

    return {"status": "disconnected", "service": service}


@router.get("/status")
async def get_integration_status(auth_token: str = Query(...)):
    """Get the connection status of all integrable services.

    Checks both Firestore (incremental OAuth tokens) AND the current
    session token scopes (from original NextAuth login) to determine
    if a service is actually connected.

    Args:
        auth_token: Google OAuth token for user identification.

    Returns:
        Dict of service_name -> {connected: bool, scopes: list}.
    """
    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    # Check what scopes the current session token already has
    session_scopes = set()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?access_token={auth_token}"
            )
            if resp.status_code == 200:
                scope_string = resp.json().get("scope", "")
                session_scopes = set(scope_string.split())
    except Exception:
        pass

    # Check Firestore for incrementally connected services
    db = get_db()
    user_ref = db.collection("users").document(user_id)
    doc = await user_ref.get()

    connected_services = {}
    spotify_connected = False
    if doc.exists:
        data = doc.to_dict() or {}
        connected_services = data.get("connected_services", {})
        spotify_tokens = data.get("spotify_tokens", {})
        spotify_connected = bool(spotify_tokens.get("access_token"))

    # Build status for each Google service — connected if EITHER
    # the session token has the scope OR Firestore has a stored token
    status_map = {}
    for service_name, scopes in SERVICE_SCOPES.items():
        # Check if the current session token already has these scopes
        session_has_scopes = all(_scope_satisfied(s, session_scopes) for s in scopes)
        # Check if Firestore has a stored incremental token
        firestore_connected = connected_services.get(service_name, {}).get("connected", False)

        status_map[service_name] = {
            "connected": session_has_scopes or firestore_connected,
            "scopes": scopes if (session_has_scopes or firestore_connected) else [],
        }

    # Add Spotify status
    status_map["spotify"] = {
        "connected": spotify_connected,
        "scopes": ["streaming", "user-read-playback-state"] if spotify_connected else [],
    }

    return status_map


@router.get("/spotify/auth-url")
async def spotify_auth_url(auth_token: str = Query(...)):
    """Generate a Spotify OAuth URL for connecting.

    Args:
        auth_token: Google OAuth token for user identification.

    Returns:
        Dict with auth_url for the Spotify OAuth consent screen.
    """
    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    # Generate a signed state parameter with CSRF nonce
    signed_state = _generate_state(user_id, "spotify")

    params = {
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.SPOTIFY_REDIRECT_URI,
        "scope": "streaming user-read-playback-state user-modify-playback-state user-read-currently-playing",
        "state": signed_state,
    }

    auth_url = f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/spotify/callback")
async def spotify_callback(code: str = Query(...), state: str = Query(...)):
    """Handle Spotify OAuth callback after user grants consent.

    Exchanges the authorization code for tokens and stores them
    in the user's spotify_tokens in Firestore.

    Args:
        code: The authorization code from Spotify.
        state: The state parameter containing user_id.

    Returns:
        Redirects to the frontend settings page.
    """
    # Verify signed state parameter (CSRF protection)
    user_id, _service = _verify_state(state)

    # Exchange authorization code for tokens
    token_data = {
        "code": code,
        "redirect_uri": settings.SPOTIFY_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            SPOTIFY_TOKEN_URL,
            data=token_data,
            auth=(settings.SPOTIFY_CLIENT_ID, settings.SPOTIFY_CLIENT_SECRET),
        )

    if response.status_code != 200:
        logger.error(f"Spotify token exchange failed: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange Spotify authorization code for tokens",
        )

    tokens = response.json()

    # Store Spotify tokens in Firestore
    db = get_db()
    user_ref = db.collection("users").document(user_id)

    spotify_data = {
        "access_token": tokens.get("access_token", ""),
        "refresh_token": tokens.get("refresh_token", ""),
        "token_type": tokens.get("token_type", "Bearer"),
        "expires_in": tokens.get("expires_in", 0),
    }

    await user_ref.set({"spotify_tokens": spotify_data}, merge=True)

    # Redirect to frontend settings page
    frontend_url = f"{settings.FRONTEND_ORIGIN}/dashboard/settings?connected=spotify"
    return RedirectResponse(url=frontend_url)


@router.delete("/spotify/disconnect")
async def spotify_disconnect(auth_token: str = Query(...)):
    """Disconnect Spotify by clearing the stored tokens.

    Args:
        auth_token: Google OAuth token for user identification.

    Returns:
        Status indicating disconnection success.
    """
    user = await verify_google_token(auth_token)
    user_id = user.get("sub", "")

    db = get_db()
    user_ref = db.collection("users").document(user_id)

    # Attempt to revoke the Spotify token before removing locally
    doc = await user_ref.get()
    if doc.exists:
        data = doc.to_dict() or {}
        spotify_tokens = data.get("spotify_tokens", {})
        access_token = spotify_tokens.get("access_token", "")
        if access_token:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        SPOTIFY_TOKEN_URL,
                        data={
                            "token": access_token,
                            "token_type_hint": "access_token",
                        },
                        auth=(settings.SPOTIFY_CLIENT_ID, settings.SPOTIFY_CLIENT_SECRET),
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                    )
            except Exception:
                # If revocation fails (network, already expired), proceed anyway
                logger.warning(f"Spotify token revocation failed for user {user_id}")

    await user_ref.update({"spotify_tokens": {}})

    return {"status": "disconnected", "service": "spotify"}
