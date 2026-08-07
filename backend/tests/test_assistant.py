from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.opportunity import Opportunity
from app.scripts.seed_dev import DEV_CREDENTIALS, seed_dev
from app.services import assistant


@pytest.fixture()
def seeded_client_and_sessionmaker() -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
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
        yield client, testing_session_local

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _login(client: TestClient, role: str = "member") -> str:
    credentials = DEV_CREDENTIALS[role]
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": credentials["email"],
            "password": credentials["password"],
        },
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _ask(client: TestClient, token: str, query: str) -> object:
    return client.post(
        "/api/v1/network/assistant",
        headers=_auth_headers(token),
        json={"query": query},
    )


def _configure_key(monkeypatch: pytest.MonkeyPatch, api_key: str) -> None:
    # get_settings() is lru_cached; patch the cached instance so the value is
    # deterministic regardless of any key in a local .env file.
    monkeypatch.setattr(get_settings(), "anthropic_api_key", api_key)


def _open_opportunity_ids(
    testing_session_local: sessionmaker[Session],
) -> list[int]:
    with testing_session_local() as db:
        ids = db.scalars(
            select(Opportunity.id)
            .where(Opportunity.status == "open")
            .order_by(Opportunity.id)
        ).all()
    assert len(ids) >= 2
    return list(ids)


def test_assistant_status_unconfigured_returns_503(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = seeded_client_and_sessionmaker
    _configure_key(monkeypatch, "")

    response = client.get(
        "/api/v1/network/assistant",
        headers=_auth_headers(_login(client)),
    )
    assert response.status_code == 503


def test_assistant_status_configured_returns_enabled(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = seeded_client_and_sessionmaker
    _configure_key(monkeypatch, "test-key")

    response = client.get(
        "/api/v1/network/assistant",
        headers=_auth_headers(_login(client)),
    )
    assert response.status_code == 200
    assert response.json() == {"enabled": True}


def test_assistant_unconfigured_returns_503(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = seeded_client_and_sessionmaker
    _configure_key(monkeypatch, "")

    response = _ask(client, _login(client), "research project about electricity")
    assert response.status_code == 503


def test_assistant_returns_reply_and_mapped_matches(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_local = seeded_client_and_sessionmaker
    _configure_key(monkeypatch, "test-key")

    open_ids = _open_opportunity_ids(session_local)
    seen_queries: list[str] = []

    def fake_find_matching_posts(query: str, posts: list[dict]) -> dict:
        seen_queries.append(query)
        assert {post["id"] for post in posts} >= set(open_ids)
        # Second-best first plus an unknown id that must be dropped.
        return {
            "reply": "Sizə uyğun elanlar tapdım.",
            "match_ids": [open_ids[1], open_ids[0], 999999],
        }

    monkeypatch.setattr(assistant, "find_matching_posts", fake_find_matching_posts)

    response = _ask(client, _login(client), "Elektriklə bağlı layihə axtarıram")
    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Sizə uyğun elanlar tapdım."
    assert [match["id"] for match in body["matches"]] == [open_ids[1], open_ids[0]]
    assert all(match["title"] for match in body["matches"])
    assert seen_queries == ["Elektriklə bağlı layihə axtarıram"]


def test_assistant_rejects_too_short_query(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = seeded_client_and_sessionmaker
    _configure_key(monkeypatch, "test-key")

    def fail_if_called(query: str, posts: list[dict]) -> dict:
        raise AssertionError("The assistant service must not be called")

    monkeypatch.setattr(assistant, "find_matching_posts", fail_if_called)

    response = _ask(client, _login(client), "a")
    assert response.status_code == 422


def test_assistant_service_failure_returns_502(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = seeded_client_and_sessionmaker
    _configure_key(monkeypatch, "test-key")

    def broken_find_matching_posts(query: str, posts: list[dict]) -> dict:
        raise assistant.AssistantError("The assistant is temporarily unavailable.")

    monkeypatch.setattr(assistant, "find_matching_posts", broken_find_matching_posts)

    response = _ask(client, _login(client), "internship in data science")
    assert response.status_code == 502
