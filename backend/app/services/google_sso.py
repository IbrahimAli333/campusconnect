"""Google ID token verification for university SSO login.

Uses Google's tokeninfo endpoint so no extra crypto dependencies are needed;
Google validates the signature and expiry server-side. The caller is
responsible for checking the audience against the configured client IDs.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx


logger = logging.getLogger(__name__)

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class GoogleSsoError(Exception):
    """Raised when a Google ID token cannot be verified."""


@dataclass(frozen=True)
class GoogleIdentity:
    email: str
    email_verified: bool
    audience: str
    full_name: str | None


def verify_google_id_token(id_token: str) -> GoogleIdentity:
    try:
        response = httpx.get(
            GOOGLE_TOKENINFO_URL,
            params={"id_token": id_token},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        logger.warning("Google tokeninfo request failed: %s", exc)
        raise GoogleSsoError("Could not reach Google to verify the sign-in") from exc

    if response.status_code != 200:
        raise GoogleSsoError("Google sign-in token is invalid or expired")

    payload = response.json()
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise GoogleSsoError("Google account did not provide an email address")

    return GoogleIdentity(
        email=email,
        email_verified=payload.get("email_verified") in (True, "true"),
        audience=payload.get("aud") or "",
        full_name=(payload.get("name") or "").strip() or None,
    )
