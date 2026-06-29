from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.scripts.seed_dev import DEV_CREDENTIALS, ensure_not_production, seed_dev


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


def _login(client: TestClient, role: str) -> str:
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


def _contains_key(value: Any, key: str) -> bool:
    if isinstance(value, dict):
        return key in value or any(_contains_key(item, key) for item in value.values())
    if isinstance(value, list):
        return any(_contains_key(item, key) for item in value)
    return False


def _table_counts(db: Session) -> dict[str, int]:
    table_names = [
        "universities",
        "faculties",
        "departments",
        "student_groups",
        "users",
        "teacher_profiles",
        "student_profiles",
        "courses",
        "enrollments",
        "lessons",
        "attendance_records",
        "grade_items",
        "grade_records",
        "materials",
        "announcements",
        "user_profiles",
        "skills",
        "user_skills",
        "resume_entries",
        "opportunities",
        "opportunity_applications",
        "connection_requests",
        "saved_opportunities",
    ]
    return {
        table_name: db.scalar(
            select(func.count()).select_from(Base.metadata.tables[table_name])
        )
        for table_name in table_names
    }


def test_seed_dev_is_importable_and_idempotent() -> None:
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

    try:
        with testing_session_local() as db:
            first_credentials = seed_dev(db)
            first_counts = _table_counts(db)
            second_credentials = seed_dev(db)
            second_counts = _table_counts(db)

        assert first_credentials == DEV_CREDENTIALS
        assert second_credentials == DEV_CREDENTIALS
        assert first_counts == second_counts
        assert first_counts["users"] == 6
        assert first_counts["enrollments"] == 2
        assert first_counts["announcements"] == 3
        assert first_counts["user_profiles"] == 6
        assert first_counts["skills"] == 23
        assert first_counts["user_skills"] == 23
        assert first_counts["resume_entries"] == 10
        assert first_counts["opportunities"] == 6
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_seed_dev_refuses_production_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(RuntimeError):
        ensure_not_production()


def test_student_portal_requires_student_role(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")

    response = client.get(
        "/api/v1/portal/student",
        headers=_auth_headers(student_token),
    )
    wrong_role_response = client.get(
        "/api/v1/portal/student",
        headers=_auth_headers(teacher_token),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["user"]["email"] == DEV_CREDENTIALS["student"]["email"]
    assert data["courses"]
    assert data["schedule"]
    assert data["materials"]
    assert data["announcements"]
    assert wrong_role_response.status_code == 403


def test_teacher_portal_requires_teacher_role(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")

    response = client.get(
        "/api/v1/portal/teacher",
        headers=_auth_headers(teacher_token),
    )
    wrong_role_response = client.get(
        "/api/v1/portal/teacher",
        headers=_auth_headers(student_token),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["user"]["email"] == DEV_CREDENTIALS["teacher"]["email"]
    assert data["assigned_courses"]
    assert data["assigned_classes"]
    assert data["upcoming_lessons"]
    assert data["pending_grade_items"]
    assert data["materials"]
    assert wrong_role_response.status_code == 403


def test_portal_responses_do_not_include_hashed_password(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker

    for role, path in (
        ("student", "/api/v1/portal/student"),
        ("teacher", "/api/v1/portal/teacher"),
    ):
        token = _login(client, role)
        response = client.get(path, headers=_auth_headers(token))
        assert response.status_code == 200
        data = response.json()
        assert not _contains_key(data, "hashed_password")
        assert not _contains_key(data, "password")
