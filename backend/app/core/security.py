from __future__ import annotations

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


def create_access_token(user_id: int, role: Union[str, UserRole]) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    role_value = role.value if isinstance(role, UserRole) else role
    payload = {
        "sub": str(user_id),
        "role": role_value,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
