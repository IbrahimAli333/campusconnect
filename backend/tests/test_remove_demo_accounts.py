from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db.base import Base
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.user import User
from app.models.user_profile import UserProfile
from app.scripts import predeploy
from app.scripts.provision_release_preview import (
    ReleasePreviewProvisioningRefused,
    ensure_release_preview_safeguards,
    provision_release_preview,
)
from app.scripts.remove_demo_accounts import DEMO_ACCOUNT_EMAILS, remove_demo_accounts


@pytest.fixture()
def db() -> Iterator[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record) -> None:  # type: ignore[no-untyped-def]
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    with sessionmaker(autocommit=False, autoflush=False, bind=engine)() as session:
        yield session
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _add_user(db: Session, email: str, name: str) -> User:
    user = User(email=email, hashed_password="x", full_name=name, role="student", is_active=True)
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id, role="student", visibility="public"))
    db.commit()
    return user


def test_removes_demo_accounts_and_their_content_only(db: Session) -> None:
    provision_release_preview(db, safeguards_confirmed=True)
    _add_user(db, "reviewer@example.edu", "App Review")
    _add_user(db, "real.person@bsu.edu.az", "Real Person")
    assert db.scalar(select(func.count(Opportunity.id))) > 0

    removed = remove_demo_accounts(db)

    assert removed == ["member@example.edu", "student@example.edu", "teacher@example.edu"]
    remaining = set(db.scalars(select(User.email)))
    assert remaining == {"reviewer@example.edu", "real.person@bsu.edu.az"}
    assert not remaining & set(DEMO_ACCOUNT_EMAILS)
    # Their posts and applications went with them.
    assert db.scalar(select(func.count(Opportunity.id))) == 0
    assert db.scalar(select(func.count(OpportunityApplication.id))) == 0
    assert db.scalar(select(func.count(UserProfile.id))) == 2

    # Running again on every deploy is a no-op.
    assert remove_demo_accounts(db) == []


def test_predeploy_only_removes_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import get_settings

    calls: list[str] = []
    monkeypatch.setattr(predeploy, "remove_demo_accounts", lambda _db: calls.append("x") or [])
    monkeypatch.setenv("UNIVERSITY_PORTAL_ENVIRONMENT", "development")
    get_settings.cache_clear()
    try:
        assert predeploy.remove_demo_accounts_in_production() == []
        assert calls == []
    finally:
        monkeypatch.delenv("UNIVERSITY_PORTAL_ENVIRONMENT")
        get_settings.cache_clear()


def test_release_preview_script_refuses_in_production() -> None:
    with pytest.raises(ReleasePreviewProvisioningRefused):
        ensure_release_preview_safeguards(
            confirm_render_preview=True,
            environ={
                "UNIVERSITY_PORTAL_ENVIRONMENT": "production",
                "UNIVERSITY_PORTAL_ALLOW_RELEASE_TEST_PROVISIONING": "true",
            },
        )
