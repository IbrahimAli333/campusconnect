from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import verify_password
from app.db.base import Base
from app.models.user import User
from app.models.user_profile import UserProfile
from app.scripts.provision_admin_accounts import (
    AccountProvisioningError,
    account_specs_from_env,
    provision_accounts,
)


ENV = {
    "UNIVERSITY_PORTAL_ADMIN_EMAIL": "admin@bridgew.edu",
    "UNIVERSITY_PORTAL_ADMIN_PASSWORD": "admin-password-123",
    "UNIVERSITY_PORTAL_REVIEWER_EMAIL": "reviewer@example.edu",
    "UNIVERSITY_PORTAL_REVIEWER_PASSWORD": "reviewer-password-123",
}


@pytest.fixture()
def db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    with session_local() as session:
        yield session
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_no_env_means_no_accounts() -> None:
    assert account_specs_from_env({}) == []


def test_partial_env_provisions_only_configured_account() -> None:
    specs = account_specs_from_env(
        {
            "UNIVERSITY_PORTAL_ADMIN_EMAIL": "admin@bridgew.edu",
            "UNIVERSITY_PORTAL_ADMIN_PASSWORD": "admin-password-123",
        }
    )
    assert [spec.email for spec in specs] == ["admin@bridgew.edu"]
    assert specs[0].role.value == "admin"


def test_short_password_is_rejected() -> None:
    with pytest.raises(AccountProvisioningError):
        account_specs_from_env(
            {
                "UNIVERSITY_PORTAL_ADMIN_EMAIL": "admin@bridgew.edu",
                "UNIVERSITY_PORTAL_ADMIN_PASSWORD": "short",
            }
        )


def test_provisioning_is_idempotent_and_sets_roles(db_session: Session) -> None:
    first = provision_accounts(db_session, ENV)
    second = provision_accounts(db_session, ENV)

    assert first == ["admin:admin@bridgew.edu", "student:reviewer@example.edu"]
    assert second == first

    users = db_session.scalars(select(User)).all()
    assert len(users) == 2

    admin = next(user for user in users if user.role == "admin")
    reviewer = next(user for user in users if user.role == "student")
    assert admin.is_active and reviewer.is_active
    assert verify_password("admin-password-123", admin.hashed_password)
    assert verify_password("reviewer-password-123", reviewer.hashed_password)

    profiles = db_session.scalars(select(UserProfile)).all()
    assert len(profiles) == 2
    assert all(profile.visibility == "private" for profile in profiles)


def test_provisioning_reclaims_existing_account(db_session: Session) -> None:
    from app.core.security import hash_password

    db_session.add(
        User(
            email="reviewer@example.edu",
            hashed_password=hash_password("old-password-123"),
            full_name="Old Name",
            role="member",
            is_active=False,
        )
    )
    db_session.commit()

    provision_accounts(db_session, ENV)

    reviewer = db_session.scalar(
        select(User).where(User.email == "reviewer@example.edu")
    )
    assert reviewer is not None
    assert reviewer.role == "student"
    assert reviewer.is_active is True
    assert verify_password("reviewer-password-123", reviewer.hashed_password)
