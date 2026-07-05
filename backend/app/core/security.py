from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Union

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.models.user import UserRole


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return password_hash.verify(password, hashed_password)
    except Exception:
        return False


def password_fingerprint(hashed_password: str) -> str:
    """Short stable digest of the stored password hash.

    Embedded in refresh tokens so a password change invalidates every
    outstanding refresh token without needing a server-side revocation store.
    """
    return hashlib.sha256(hashed_password.encode()).hexdigest()[:16]


def create_access_token(user_id: int, role: Union[str, UserRole]) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    role_value = role.value if isinstance(role, UserRole) else role
    payload = {
        "sub": str(user_id),
        "role": role_value,
        "type": "access",
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(user_id: int, hashed_password: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "pwd_fp": password_fingerprint(hashed_password),
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    # Tokens minted before the type claim existed are access tokens; refresh
    # tokens must never authenticate API requests directly.
    if payload.get("type") not in (None, "access"):
        raise jwt.InvalidTokenError("Not an access token")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Not a refresh token")
    return payload
