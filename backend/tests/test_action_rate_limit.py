from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.action_rate_limit import enforce_action_limit
from app.core.login_rate_limit import LoginRateLimiter
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.scripts.seed_dev import DEV_CREDENTIALS, seed_dev


@pytest.fixture()
def seeded_client() -> Iterator[TestClient]:
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

    with testing_session_local() as db:
        seed_dev(db)

    app = create_app()

    def override_get_db() -> Iterator[Session]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _login(client: TestClient, role: str) -> str:
    credentials = DEV_CREDENTIALS[role]
    response = client.post(
        "/api/v1/auth/login",
        json={"email": credentials["email"], "password": credentials["password"]},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_enforce_action_limit_blocks_after_budget_is_spent() -> None:
    limiter = LoginRateLimiter(max_attempts=3, window_seconds=60)

    for _ in range(3):
        enforce_action_limit(limiter, user_id=1)

    with pytest.raises(HTTPException) as exc_info:
        enforce_action_limit(limiter, user_id=1)

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers["Retry-After"] == "60"

    # Another user is unaffected by the first user's spending.
    enforce_action_limit(limiter, user_id=2)


def test_opportunity_creation_is_rate_limited(seeded_client: TestClient) -> None:
    client = seeded_client
    token = _login(client, "student")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "type": "project",
        "title": "Open Source Campus Map",
        "description": "Build a mobile map for labs, events, and study spaces.",
        "required_skills": ["React Native"],
        "status": "open",
    }

    for _ in range(10):
        response = client.post(
            "/api/v1/network/opportunities", headers=headers, json=payload
        )
        assert response.status_code == 201

    blocked = client.post(
        "/api/v1/network/opportunities", headers=headers, json=payload
    )

    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers
