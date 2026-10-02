from __future__ import annotations

from collections.abc import Callable
from typing import Optional, Union

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.legal import CURRENT_TERMS_VERSION, TERMS_ACCEPTANCE_REQUIRED_DETAIL
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole


bearer_scheme = HTTPBearer(auto_error=False)


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _credentials_exception()

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload.get("sub", ""))
    except (jwt.PyJWTError, TypeError, ValueError):
        raise _credentials_exception() from None

    user = db.get(User, user_id)
    if user is None:
        raise _credentials_exception()
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return current_user


def require_current_terms(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Refuse feature endpoints until the current terms are accepted.

    Only active when UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE is on. Account
    endpoints (me, accept-terms, data export, delete-account) never use this,
    so people can always read, accept, export, or leave.
    """
    if not get_settings().enforce_terms_acceptance:
        return current_user
    if (
        current_user.terms_version != CURRENT_TERMS_VERSION
        or current_user.age_confirmed_at is None
    ):
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail=TERMS_ACCEPTANCE_REQUIRED_DETAIL,
        )
    return current_user


def require_roles(*roles: Union[str, UserRole]) -> Callable[[User], User]:
    allowed_roles = {role.value if isinstance(role, UserRole) else role for role in roles}

    def dependency(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency
