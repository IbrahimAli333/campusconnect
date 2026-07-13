import secrets

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.config import get_settings
from app.core.login_rate_limit import ip_rate_limiter, login_rate_limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from app.core.universities import university_for_email
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.user_profile import NETWORK_PROFILE_ROLES, UserProfile
from app.schemas.auth import (
    BootstrapAdminRequest,
    ChangePasswordRequest,
    DeleteAccountRequest,
    GoogleSsoRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
)
from app.schemas.user import UserRead
from app.services.google_sso import GoogleSsoError, verify_google_id_token


router = APIRouter(prefix="/auth", tags=["auth"])


def _verify_google_reauth(id_token: str, current_user: User) -> None:
    """Confirm account ownership with a fresh Google ID token.

    SSO accounts have no usable password, so sensitive actions accept a Google
    ID token for the account's own email instead. The token gets the same
    audience and verification checks as SSO login.
    """
    allowed_audiences = get_settings().parsed_google_oauth_client_ids()
    if not allowed_audiences:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured",
        )

    try:
        identity = verify_google_id_token(id_token)
    except GoogleSsoError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    if identity.audience not in allowed_audiences:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google sign-in token was issued for another application",
        )

    if not identity.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google account email is not verified",
        )

    if identity.email != current_user.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google account does not match this CampusConnect account",
        )


@router.post(
    "/bootstrap-admin",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def bootstrap_admin(
    request: BootstrapAdminRequest,
    db: Session = Depends(get_db),
) -> User:
    settings = get_settings()
    if (
        settings.environment.lower() in {"prod", "production"}
        and not settings.enable_bootstrap_admin
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found",
        )

    user_count = db.scalar(select(func.count(User.id)))
    if user_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bootstrap admin is only available before users exist",
        )

    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        role=UserRole.admin.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.hashed_password),
        user=UserRead.model_validate(user),
    )


def _client_ip(http_request: Request) -> str:
    # Behind Render's proxy uvicorn runs with --proxy-headers, so
    # request.client already reflects the X-Forwarded-For client address.
    client = http_request.client
    return client.host if client is not None else "unknown"


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    http_request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    client_ip = _client_ip(http_request)
    credential_key = f"{client_ip}|{request.email}"
    if login_rate_limiter.is_blocked(credential_key) or ip_rate_limiter.is_blocked(
        client_ip
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(login_rate_limiter.window_seconds)},
        )

    user = db.scalar(select(User).where(User.email == request.email))
    if user is None or not verify_password(request.password, user.hashed_password):
        login_rate_limiter.record_failure(credential_key)
        ip_rate_limiter.record_failure(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        # Same message as a bad password so responses don't reveal whether an
        # account exists but was deactivated.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Only the credential counter resets on success: an attacker interleaving
    # their own valid logins must not erase spray evidence against the IP.
    login_rate_limiter.record_success(credential_key)
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_session(
    request: RefreshRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    try:
        payload = decode_refresh_token(request.refresh_token)
        user_id = int(payload.get("sub", ""))
    except (jwt.PyJWTError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # A password change rotates the fingerprint, revoking older refresh tokens.
    if payload.get("pwd_fp") != password_fingerprint(user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _token_response(user)


@router.post("/sso/google", response_model=TokenResponse)
def login_with_google(
    request: GoogleSsoRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    allowed_audiences = get_settings().parsed_google_oauth_client_ids()
    if not allowed_audiences:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured",
        )

    try:
        identity = verify_google_id_token(request.id_token)
    except GoogleSsoError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    if identity.audience not in allowed_audiences:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google sign-in token was issued for another application",
        )

    if not identity.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google account email is not verified",
        )

    university = university_for_email(identity.email)
    if university is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sign in with your university email account",
        )

    user = db.scalar(select(User).where(User.email == identity.email))
    if user is None:
        user = User(
            email=identity.email,
            # SSO accounts have no usable password; login stays Google-only.
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=identity.full_name or identity.email.split("@")[0],
            role=UserRole.member.value,
            is_active=True,
        )
        db.add(user)
        db.flush()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
            headers={"WWW-Authenticate": "Bearer"},
        )

    profile = user.network_profile
    if profile is None:
        profile = UserProfile(
            user_id=user.id,
            role=user.role if user.role in NETWORK_PROFILE_ROLES else "member",
            university=university,
            visibility="public",
        )
        db.add(profile)
    elif not profile.university:
        profile.university = university

    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    if request.google_id_token:
        _verify_google_reauth(request.google_id_token, current_user)
    elif not verify_password(
        request.current_password or "", current_user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = hash_password(request.new_password)
    db.commit()


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    request: DeleteAccountRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    if request.google_id_token:
        _verify_google_reauth(request.google_id_token, current_user)
    elif not verify_password(request.password or "", current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect",
        )

    db.delete(current_user)
    db.commit()


@router.get("/me", response_model=UserRead)
def read_me(
    current_user: User = Depends(get_current_active_user),
) -> User:
    return current_user
