"""Provision the production admin and store-reviewer accounts.

Designed to run as part of the Render preDeployCommand: it is a silent no-op
until the password env vars are set in the Render dashboard, and it is
idempotent, so every later deploy just re-asserts the same state. Passwords
never live in the repo or in logs — only in Render env vars.

- Admin account: gets the `admin` role and access to /api/v1/admin moderation.
- Reviewer account: a `student` role account (can browse, apply, connect,
  post startup/project content) for Apple App Review and Google Play review.

Env vars (all with the UNIVERSITY_PORTAL_ prefix):
- ADMIN_EMAIL / ADMIN_PASSWORD
- REVIEWER_EMAIL / REVIEWER_PASSWORD

An account is provisioned only when both its email and password are set;
passwords shorter than MIN_PASSWORD_LENGTH fail the run loudly.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Mapping
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.user_profile import UserProfile


ADMIN_EMAIL_ENV = "UNIVERSITY_PORTAL_ADMIN_EMAIL"
ADMIN_PASSWORD_ENV = "UNIVERSITY_PORTAL_ADMIN_PASSWORD"
REVIEWER_EMAIL_ENV = "UNIVERSITY_PORTAL_REVIEWER_EMAIL"
REVIEWER_PASSWORD_ENV = "UNIVERSITY_PORTAL_REVIEWER_PASSWORD"

MIN_PASSWORD_LENGTH = 12


class AccountProvisioningError(RuntimeError):
    pass


@dataclass(frozen=True)
class AccountSpec:
    email: str
    password: str
    full_name: str
    role: UserRole
    profile_role: str
    headline: str
    visibility: str


def _spec_from_env(
    environ: Mapping[str, str],
    *,
    email_var: str,
    password_var: str,
    full_name: str,
    role: UserRole,
    profile_role: str,
    headline: str,
    visibility: str,
) -> AccountSpec | None:
    email = environ.get(email_var, "").strip().lower()
    password = environ.get(password_var, "")
    if not email or not password:
        return None
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AccountProvisioningError(
            f"{password_var} must be at least {MIN_PASSWORD_LENGTH} characters"
        )
    return AccountSpec(
        email=email,
        password=password,
        full_name=full_name,
        role=role,
        profile_role=profile_role,
        headline=headline,
        visibility=visibility,
    )


def account_specs_from_env(
    environ: Mapping[str, str] | None = None,
) -> list[AccountSpec]:
    values = os.environ if environ is None else environ
    specs = [
        _spec_from_env(
            values,
            email_var=ADMIN_EMAIL_ENV,
            password_var=ADMIN_PASSWORD_ENV,
            full_name="CampusConnect Admin",
            role=UserRole.admin,
            profile_role="member",
            headline="CampusConnect moderation",
            # Keep the moderation account out of Discover feeds.
            visibility="private",
        ),
        _spec_from_env(
            values,
            email_var=REVIEWER_EMAIL_ENV,
            password_var=REVIEWER_PASSWORD_ENV,
            full_name="App Review",
            role=UserRole.student,
            profile_role="student",
            headline="Store review account",
            visibility="private",
        ),
    ]
    return [spec for spec in specs if spec is not None]


def provision_account(db: Session, spec: AccountSpec) -> User:
    user = db.scalar(select(User).where(User.email == spec.email))
    if user is None:
        user = User(
            email=spec.email,
            hashed_password=hash_password(spec.password),
            full_name=spec.full_name,
            role=spec.role.value,
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        user.hashed_password = hash_password(spec.password)
        user.full_name = spec.full_name
        user.role = spec.role.value
        user.is_active = True
        db.flush()

    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        profile = UserProfile(
            user_id=user.id,
            role=spec.profile_role,
            headline=spec.headline,
            visibility=spec.visibility,
        )
        db.add(profile)
    else:
        profile.role = spec.profile_role
        profile.headline = spec.headline
        profile.visibility = spec.visibility
    db.flush()
    return user


def provision_accounts(
    db: Session,
    environ: Mapping[str, str] | None = None,
) -> list[str]:
    provisioned: list[str] = []
    for spec in account_specs_from_env(environ):
        provision_account(db, spec)
        provisioned.append(f"{spec.role.value}:{spec.email}")
    db.commit()
    return provisioned


def main(environ: Mapping[str, str] | None = None) -> int:
    try:
        specs = account_specs_from_env(environ)
    except AccountProvisioningError as exc:
        print(f"Account provisioning failed: {exc}", file=sys.stderr)
        return 2

    if not specs:
        print(
            "Account provisioning skipped: no "
            f"{ADMIN_PASSWORD_ENV}/{REVIEWER_PASSWORD_ENV} configured."
        )
        return 0

    from app.db.session import SessionLocal

    with SessionLocal() as db:
        try:
            provisioned = provision_accounts(db, environ)
        except Exception:
            db.rollback()
            raise

    for entry in provisioned:
        print(f"Provisioned {entry}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
