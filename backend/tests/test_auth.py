from collections.abc import Iterator

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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
