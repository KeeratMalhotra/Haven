"""Google OAuth token validation middleware."""

from typing import Optional

import httpx
from fastapi import HTTPException, status

from app.config import settings

# Google tokeninfo endpoint for validating OAuth2 access tokens
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


async def verify_google_token(token: str) -> dict:
    """Verify a Google OAuth access token using the tokeninfo endpoint.

    This validates opaque OAuth2 access tokens (not JWT ID tokens).
    The tokeninfo endpoint returns the token's metadata including the
    associated user information.

    Args:
        token: The Google OAuth access token to verify.

    Returns:
        Dictionary containing user information (sub, email, name, picture).

    Raises:
        HTTPException: If token validation fails.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GOOGLE_TOKENINFO_URL,
                params={"access_token": token},
            )

        if response.status_code != 200:
            raise ValueError("Token validation failed")

        token_info = response.json()

        # Verify the token was issued for our application
        # The 'aud' field contains the client ID the token was issued to
        token_aud = token_info.get("aud", "")
        if settings.GOOGLE_CLIENT_ID and token_aud != settings.GOOGLE_CLIENT_ID:
            raise ValueError("Token was not issued for this application")

        # Verify token has not expired (expires_in > 0)
        expires_in = int(token_info.get("expires_in", 0))
        if expires_in <= 0:
            raise ValueError("Token has expired")

        return {
            "sub": token_info.get("sub", ""),
            "email": token_info.get("email", ""),
            "name": token_info.get("name", ""),
            "picture": token_info.get("picture", ""),
        }
    except (ValueError, KeyError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {e}",
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to validate token: {e}",
        )


async def get_current_user(auth_token: str) -> Optional[dict]:
    """Extract and validate user from auth token.

    Args:
        auth_token: The auth token from WebSocket or HTTP request.

    Returns:
        User info dict if valid, None if token is empty/missing.
    """
    if not auth_token:
        return None
    return await verify_google_token(auth_token)
