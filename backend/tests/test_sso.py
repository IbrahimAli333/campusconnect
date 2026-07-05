from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
import app.api.v1.auth as auth_module
from app.core.config import Settings
from app.core.universities import university_for_email
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.user import User
from app.models.user_profile import UserProfile
from app.services.google_sso import GoogleIdentity


CLIENT_ID = "test-client-id.apps.googleusercontent.com"


@pytest.fixture()
def client_and_sessionmaker() -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    Base.metadata.create_all(bind=engine)
    app = create_app()

    def override_get_db() -> Iterator[Session]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client, testing_session_local

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def configure_sso(monkeypatch: pytest.MonkeyPatch, client_ids: str = CLIENT_ID) -> None:
    monkeypatch.setattr(
        auth_module,
        "get_settings",
        lambda: Settings(google_oauth_client_ids=client_ids),
    )


def stub_identity(
    monkeypatch: pytest.MonkeyPatch,
    email: str = "aysel.aliyeva@bsu.edu.az",
    email_verified: bool = True,
    audience: str = CLIENT_ID,
    full_name: str | None = "Aysel Aliyeva",
) -> None:
    identity = GoogleIdentity(
        email=email,
        email_verified=email_verified,
        audience=audience,
        full_name=full_name,
    )
    monkeypatch.setattr(auth_module, "verify_google_id_token", lambda _: identity)


def sso_login(client: TestClient) -> object:
    return client.post("/api/v1/auth/sso/google", json={"id_token": "stub-token"})


def test_university_domain_mapping() -> None:
    assert university_for_email("student@bsu.edu.az") == "Baku State University"
    assert university_for_email("someone@student.bsu.edu.az") == "Baku State University"
    assert university_for_email("a@ada.edu.az") == "ADA University"
    assert university_for_email("x@gmail.com") is None
    assert university_for_email("not-an-email") is None
    # Similar-looking but different domains must not match by suffix.
    assert university_for_email("x@notbsu.edu.az") is None


def test_sso_unconfigured_returns_503(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = client_and_sessionmaker
    configure_sso(monkeypatch, client_ids="")
    stub_identity(monkeypatch)

    response = sso_login(client)
    assert response.status_code == 503


def test_sso_creates_member_user_with_university_profile(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_local = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch)

    response = sso_login(client)
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "aysel.aliyeva@bsu.edu.az"
    assert body["user"]["role"] == "member"
    assert body["access_token"]

    with session_local() as db:
        user = db.scalar(select(User).where(User.email == "aysel.aliyeva@bsu.edu.az"))
        assert user is not None
        profile = db.scalar(
            select(UserProfile).where(UserProfile.user_id == user.id)
        )
        assert profile is not None
        assert profile.university == "Baku State University"
        assert profile.role == "member"

    # Token works against an authenticated endpoint.
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200


def test_sso_second_login_reuses_account(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_local = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch)

    first = sso_login(client)
    second = sso_login(client)
    assert first.status_code == 200
    assert second.status_code == 200

    with session_local() as db:
        users = db.scalars(select(User)).all()
        assert len(users) == 1


def test_sso_rejects_non_university_email(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_local = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch, email="someone@gmail.com")

    response = sso_login(client)
    assert response.status_code == 403
    assert "university email" in response.json()["detail"]

    with session_local() as db:
        assert db.scalars(select(User)).all() == []


def test_sso_rejects_unverified_email(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch, email_verified=False)

    response = sso_login(client)
    assert response.status_code == 403


def test_sso_rejects_foreign_audience(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch, audience="other-app.apps.googleusercontent.com")

    response = sso_login(client)
    assert response.status_code == 401


def test_sso_sets_university_on_existing_profile_without_one(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_local = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch)

    # First SSO login creates the account; blank out the university to
    # simulate an older profile, then log in again.
    assert sso_login(client).status_code == 200
    with session_local() as db:
        profile = db.scalars(select(UserProfile)).one()
        profile.university = None
        db.commit()

    assert sso_login(client).status_code == 200
    with session_local() as db:
        profile = db.scalars(select(UserProfile)).one()
        assert profile.university == "Baku State University"


def test_sso_user_can_delete_account_with_google_reauth(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_local = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch)

    access_token = sso_login(client).json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # The random SSO password can never be known, so the password path fails.
    password_attempt = client.post(
        "/api/v1/auth/delete-account",
        headers=headers,
        json={"password": "guessed-password"},
    )
    assert password_attempt.status_code == 400

    response = client.post(
        "/api/v1/auth/delete-account",
        headers=headers,
        json={"google_id_token": "stub-token"},
    )
    assert response.status_code == 204

    with session_local() as db:
        user = db.scalar(select(User).where(User.email == "aysel.aliyeva@bsu.edu.az"))
        assert user is None


def test_google_reauth_rejects_token_for_other_account(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_local = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch)

    access_token = sso_login(client).json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # A valid Google token for a different email must not authorize deletion.
    stub_identity(monkeypatch, email="someone.else@bsu.edu.az")
    response = client.post(
        "/api/v1/auth/delete-account",
        headers=headers,
        json={"google_id_token": "stub-token"},
    )
    assert response.status_code == 403

    with session_local() as db:
        user = db.scalar(select(User).where(User.email == "aysel.aliyeva@bsu.edu.az"))
        assert user is not None


def test_delete_account_requires_exactly_one_credential(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch)

    access_token = sso_login(client).json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    neither = client.post(
        "/api/v1/auth/delete-account",
        headers=headers,
        json={},
    )
    both = client.post(
        "/api/v1/auth/delete-account",
        headers=headers,
        json={"password": "irrelevant", "google_id_token": "stub-token"},
    )
    assert neither.status_code == 422
    assert both.status_code == 422


def test_sso_user_can_set_password_with_google_reauth(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = client_and_sessionmaker
    configure_sso(monkeypatch)
    stub_identity(monkeypatch)

    access_token = sso_login(client).json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"google_id_token": "stub-token", "new_password": "fresh-password-123"},
    )
    assert response.status_code == 204

    # The account now has a usable password for regular login.
    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "aysel.aliyeva@bsu.edu.az",
            "password": "fresh-password-123",
        },
    )
    assert login_response.status_code == 200
