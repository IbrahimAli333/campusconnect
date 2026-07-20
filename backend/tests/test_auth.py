from collections.abc import Iterator

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.api.deps import require_roles
from app.db.base import Base
from app.db.session import get_db
from app.models.user import User, UserRole
from app.main import create_app


ADMIN_PAYLOAD = {
    "email": "admin@example.edu",
    "password": "correct-password",
    "full_name": "First Admin",
}


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

    @app.get("/test/teacher-only")
    def teacher_only(
        _: User = Depends(require_roles(UserRole.teacher)),
    ) -> dict[str, bool]:
        return {"ok": True}

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


def bootstrap_admin(client: TestClient) -> dict:
    response = client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)
    assert response.status_code == 201
    return response.json()


def login_admin(client: TestClient, password: str = "correct-password") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_PAYLOAD["email"], "password": password},
    )
    assert response.status_code == 200
    return response.json()


def test_bootstrap_creates_first_admin(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker

    data = bootstrap_admin(client)

    assert data["email"] == ADMIN_PAYLOAD["email"]
    assert data["full_name"] == ADMIN_PAYLOAD["full_name"]
    assert data["role"] == UserRole.admin.value
    assert data["is_active"] is True
    assert "password" not in data
    assert "hashed_password" not in data


def test_second_bootstrap_fails(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker
    bootstrap_admin(client)

    response = client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)

    assert response.status_code == 409


def test_login_works_with_correct_password(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker
    bootstrap_admin(client)

    data = login_admin(client)

    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == ADMIN_PAYLOAD["email"]
    assert data["user"]["role"] == UserRole.admin.value
    assert "password" not in data["user"]
    assert "hashed_password" not in data["user"]


def test_login_fails_with_wrong_password(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker
    bootstrap_admin(client)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_PAYLOAD["email"], "password": "wrong-password"},
    )

    assert response.status_code == 401


def test_inactive_users_cannot_login(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = client_and_sessionmaker
    bootstrap_admin(client)

    with testing_session_local() as db:
        user = db.query(User).filter(User.email == ADMIN_PAYLOAD["email"]).one()
        user.is_active = False
        db.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_PAYLOAD["email"], "password": "correct-password"},
    )

    assert response.status_code == 401
    # The response must be indistinguishable from a wrong password so it does
    # not reveal that the account exists but was deactivated.
    assert response.json()["detail"] == "Invalid email or password"


def test_auth_me_returns_current_user_with_bearer_token(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker
    bootstrap_admin(client)
    token = login_admin(client)["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == ADMIN_PAYLOAD["email"]


def test_auth_me_rejects_missing_and_invalid_token(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker

    missing_response = client.get("/api/v1/auth/me")
    invalid_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert missing_response.status_code == 401
    assert invalid_response.status_code == 401


def test_require_roles_blocks_wrong_role(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker
    bootstrap_admin(client)
    token = login_admin(client)["access_token"]

    response = client.get(
        "/test/teacher-only",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_password_hashes_do_not_equal_raw_password(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = client_and_sessionmaker
    bootstrap_admin(client)

    with testing_session_local() as db:
        user = db.query(User).filter(User.email == ADMIN_PAYLOAD["email"]).one()

    assert user.hashed_password != ADMIN_PAYLOAD["password"]


def _seed_and_login_payload() -> dict[str, str]:
    return {"email": ADMIN_PAYLOAD["email"], "password": ADMIN_PAYLOAD["password"]}


def test_login_is_rate_limited_after_repeated_failures(
    client_and_sessionmaker: tuple[TestClient, "sessionmaker[Session]"],
) -> None:
    client, _ = client_and_sessionmaker
    client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)

    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_PAYLOAD["email"], "password": "wrong-password"},
        )
        assert response.status_code == 401

    blocked_response = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_PAYLOAD["email"], "password": "wrong-password"},
    )
    blocked_valid_response = client.post(
        "/api/v1/auth/login",
        json=_seed_and_login_payload(),
    )

    assert blocked_response.status_code == 429
    assert "Retry-After" in blocked_response.headers
    assert blocked_valid_response.status_code == 429


def test_successful_login_resets_failure_count(
    client_and_sessionmaker: tuple[TestClient, "sessionmaker[Session]"],
) -> None:
    client, _ = client_and_sessionmaker
    client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)

    for _ in range(4):
        client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_PAYLOAD["email"], "password": "wrong-password"},
        )

    success_response = client.post("/api/v1/auth/login", json=_seed_and_login_payload())
    for _ in range(4):
        client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_PAYLOAD["email"], "password": "wrong-password"},
        )
    after_reset_response = client.post(
        "/api/v1/auth/login",
        json=_seed_and_login_payload(),
    )

    assert success_response.status_code == 200
    assert after_reset_response.status_code == 200


def test_user_can_change_password(
    client_and_sessionmaker: tuple[TestClient, "sessionmaker[Session]"],
) -> None:
    client, _ = client_and_sessionmaker
    client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)
    token = client.post("/api/v1/auth/login", json=_seed_and_login_payload()).json()[
        "access_token"
    ]

    wrong_current_response = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "not-the-password", "new_password": "new-secret-password"},
    )
    change_response = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": ADMIN_PAYLOAD["password"],
            "new_password": "new-secret-password",
        },
    )
    old_password_login = client.post("/api/v1/auth/login", json=_seed_and_login_payload())
    new_password_login = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_PAYLOAD["email"], "password": "new-secret-password"},
    )

    assert wrong_current_response.status_code == 400
    assert change_response.status_code == 204
    assert old_password_login.status_code == 401
    assert new_password_login.status_code == 200


def test_password_spray_across_emails_is_ip_rate_limited(
    client_and_sessionmaker: tuple[TestClient, "sessionmaker[Session]"],
) -> None:
    client, _ = client_and_sessionmaker
    client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)

    # One address rotating through many emails never trips the per-credential
    # limiter, but the per-IP limiter must eventually stop it.
    for index in range(50):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": f"victim{index}@example.edu", "password": "Spray-123"},
        )
        assert response.status_code == 401

    sprayed_response = client.post(
        "/api/v1/auth/login",
        json={"email": "victim51@example.edu", "password": "Spray-123"},
    )
    valid_after_spray = client.post(
        "/api/v1/auth/login",
        json=_seed_and_login_payload(),
    )

    assert sprayed_response.status_code == 429
    # The IP block also stops valid logins from the spraying address.
    assert valid_after_spray.status_code == 429


def test_refresh_token_rotates_session(
    client_and_sessionmaker: tuple[TestClient, "sessionmaker[Session]"],
) -> None:
    client, _ = client_and_sessionmaker
    client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)
    login_response = client.post("/api/v1/auth/login", json=_seed_and_login_payload())
    assert login_response.status_code == 200
    body = login_response.json()
    assert body["refresh_token"]

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": body["refresh_token"]},
    )

    assert refresh_response.status_code == 200
    refreshed = refresh_response.json()
    assert refreshed["access_token"]
    assert refreshed["refresh_token"]
    assert refreshed["user"]["email"] == ADMIN_PAYLOAD["email"]

    # The new access token authenticates API requests.
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refreshed['access_token']}"},
    )
    assert me.status_code == 200


def test_access_token_is_rejected_as_refresh_token_and_vice_versa(
    client_and_sessionmaker: tuple[TestClient, "sessionmaker[Session]"],
) -> None:
    client, _ = client_and_sessionmaker
    client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)
    body = client.post("/api/v1/auth/login", json=_seed_and_login_payload()).json()

    refresh_with_access = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": body["access_token"]},
    )
    me_with_refresh = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['refresh_token']}"},
    )

    assert refresh_with_access.status_code == 401
    assert me_with_refresh.status_code == 401


def test_password_change_revokes_outstanding_refresh_tokens(
    client_and_sessionmaker: tuple[TestClient, "sessionmaker[Session]"],
) -> None:
    client, _ = client_and_sessionmaker
    client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)
    body = client.post("/api/v1/auth/login", json=_seed_and_login_payload()).json()

    change_response = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {body['access_token']}"},
        json={
            "current_password": ADMIN_PAYLOAD["password"],
            "new_password": "rotated-password-123",
        },
    )
    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": body["refresh_token"]},
    )

    assert change_response.status_code == 204
    assert refresh_response.status_code == 401


def test_bootstrap_admin_is_gated_in_production(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core.config import get_settings

    client, _ = client_and_sessionmaker
    monkeypatch.setenv("UNIVERSITY_PORTAL_ENVIRONMENT", "production")
    monkeypatch.setenv("UNIVERSITY_PORTAL_SECRET_KEY", "test-production-secret")
    get_settings.cache_clear()

    try:
        response = client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)
        assert response.status_code == 404

        monkeypatch.setenv("UNIVERSITY_PORTAL_ENABLE_BOOTSTRAP_ADMIN", "1")
        get_settings.cache_clear()

        response = client.post("/api/v1/auth/bootstrap-admin", json=ADMIN_PAYLOAD)
        assert response.status_code == 201
    finally:
        get_settings.cache_clear()


def test_register_creates_member_with_profile(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = client_and_sessionmaker

    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "  New.Member@BSU.edu.az ",
            "password": "fresh-password-1",
            "full_name": "  Nigar Aliyeva  ",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "new.member@bsu.edu.az"
    assert body["user"]["full_name"] == "Nigar Aliyeva"
    assert body["user"]["role"] == "member"

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200

    with testing_session_local() as db:
        user = db.scalar(select(User).where(User.email == "new.member@bsu.edu.az"))
        assert user is not None
        profile = user.network_profile
        assert profile is not None
        assert profile.role == "member"
        assert profile.university == "Baku State University"
        assert profile.visibility == "public"


def test_register_without_university_domain_leaves_university_unset(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = client_and_sessionmaker

    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "tester@gmail.com",
            "password": "fresh-password-1",
            "full_name": "Gmail Tester",
        },
    )

    assert response.status_code == 201
    with testing_session_local() as db:
        user = db.scalar(select(User).where(User.email == "tester@gmail.com"))
        assert user is not None
        assert user.network_profile is not None
        assert user.network_profile.university is None


def test_register_duplicate_email_conflicts(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker
    payload = {
        "email": "taken@example.edu",
        "password": "fresh-password-1",
        "full_name": "First Claimant",
    }
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201

    duplicate = client.post(
        "/api/v1/auth/register",
        json={**payload, "email": "  TAKEN@example.edu "},
    )
    assert duplicate.status_code == 409


def test_register_rejects_short_password(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "short@example.edu",
            "password": "seven77",
            "full_name": "Short Password",
        },
    )
    assert response.status_code == 422


def test_register_rate_limits_per_ip(
    client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = client_and_sessionmaker

    for index in range(10):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"bulk-{index}@example.edu",
                "password": "fresh-password-1",
                "full_name": f"Bulk {index}",
            },
        )
        assert response.status_code == 201

    blocked = client.post(
        "/api/v1/auth/register",
        json={
            "email": "bulk-final@example.edu",
            "password": "fresh-password-1",
            "full_name": "Bulk Final",
        },
    )
    assert blocked.status_code == 429
