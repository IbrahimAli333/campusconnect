import pytest
from fastapi.testclient import TestClient

from app.core.config import (
    DEFAULT_SECRET_KEY,
    DEVELOPMENT_CORS_ORIGIN_REGEX,
    Settings,
    get_settings,
)
from app.main import create_app


def test_default_secret_key_is_rejected_in_production() -> None:
    with pytest.raises(ValueError):
        Settings(environment="production", secret_key=DEFAULT_SECRET_KEY)


def test_render_postgres_url_uses_configured_psycopg_driver() -> None:
    settings = Settings(
        database_url="postgresql://campusconnect:secret@example.com:5432/campusconnect"
    )

    assert settings.database_url == (
        "postgresql+psycopg://campusconnect:secret@example.com:5432/campusconnect"
    )


def test_settings_reports_production_environment() -> None:
    assert Settings(environment="production", secret_key="safe-secret").is_production()
    assert not Settings(environment="development").is_production()


def test_development_cors_regex_matches_local_expo_web_origins() -> None:
    import re

    assert re.match(DEVELOPMENT_CORS_ORIGIN_REGEX, "http://localhost:8081")
    assert re.match(DEVELOPMENT_CORS_ORIGIN_REGEX, "http://172.20.10.2:8081")
    assert re.match(DEVELOPMENT_CORS_ORIGIN_REGEX, "http://192.168.1.184:8081")
    assert not re.match(DEVELOPMENT_CORS_ORIGIN_REGEX, "https://example.com")


def cors_preflight(client: TestClient, origin: str):
    return client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )


def test_development_cors_allows_local_origins_with_explicit_origins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UNIVERSITY_PORTAL_ENVIRONMENT", "development")
    monkeypatch.setenv("UNIVERSITY_PORTAL_CORS_ORIGINS", "https://portal.example.edu")
    get_settings.cache_clear()

    try:
        client = TestClient(create_app())

        response = cors_preflight(client, "http://localhost:8081")

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
    finally:
        get_settings.cache_clear()


def test_production_cors_does_not_allow_private_lan_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UNIVERSITY_PORTAL_ENVIRONMENT", "production")
    monkeypatch.setenv("UNIVERSITY_PORTAL_SECRET_KEY", "safe-secret")
    monkeypatch.delenv("UNIVERSITY_PORTAL_CORS_ORIGINS", raising=False)
    get_settings.cache_clear()

    try:
        client = TestClient(create_app())

        response = cors_preflight(client, "http://172.20.10.2:8081")

        assert response.status_code != 200
        assert "access-control-allow-origin" not in response.headers
    finally:
        get_settings.cache_clear()


def test_production_cors_uses_explicit_origins_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UNIVERSITY_PORTAL_ENVIRONMENT", "production")
    monkeypatch.setenv("UNIVERSITY_PORTAL_SECRET_KEY", "safe-secret")
    monkeypatch.setenv("UNIVERSITY_PORTAL_CORS_ORIGINS", "https://portal.example.edu")
    get_settings.cache_clear()

    try:
        client = TestClient(create_app())

        allowed = cors_preflight(client, "https://portal.example.edu")
        blocked = cors_preflight(client, "http://172.20.10.2:8081")

        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "https://portal.example.edu"
        assert blocked.status_code == 400
        assert "access-control-allow-origin" not in blocked.headers
    finally:
        get_settings.cache_clear()
