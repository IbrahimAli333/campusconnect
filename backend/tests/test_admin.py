from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.opportunity import Opportunity
from app.models.user import User, UserRole
from app.models.user_profile import UserProfile
from app.scripts.seed_dev import DEV_CREDENTIALS, seed_dev


ADMIN_EMAIL = "moderator@example.edu"
ADMIN_PASSWORD = "moderator-password"


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
        db.add(
            User(
                email=ADMIN_EMAIL,
                hashed_password=hash_password(ADMIN_PASSWORD),
                full_name="Site Moderator",
                role=UserRole.admin.value,
                is_active=True,
            )
        )
        db.commit()

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


def _login_with(client: TestClient, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _login(client: TestClient, role: str) -> str:
    credentials = DEV_CREDENTIALS[role]
    return _login_with(client, credentials["email"], credentials["password"])


def _login_admin(client: TestClient) -> str:
    return _login_with(client, ADMIN_EMAIL, ADMIN_PASSWORD)


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _file_profile_report(
    client: TestClient,
    testing_session_local: sessionmaker[Session],
) -> int:
    member_token = _login(client, "member")
    with testing_session_local() as db:
        target_profile_id = db.scalar(
            select(UserProfile.id)
            .join(User)
            .where(User.email == DEV_CREDENTIALS["teacher"]["email"])
        )
    assert target_profile_id is not None

    response = client.post(
        "/api/v1/network/reports",
        headers=_auth_headers(member_token),
        json={
            "target_type": "profile",
            "target_id": target_profile_id,
            "reason": "Spam in the profile headline",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_admin_endpoints_reject_non_admins(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    member_token = _login(client, "member")

    response = client.get(
        "/api/v1/admin/reports", headers=_auth_headers(member_token)
    )

    assert response.status_code == 403


def test_admin_lists_and_resolves_reports(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    report_id = _file_profile_report(client, testing_session_local)
    admin_token = _login_admin(client)

    listed = client.get(
        "/api/v1/admin/reports",
        headers=_auth_headers(admin_token),
        params={"status": "open"},
    )
    assert listed.status_code == 200
    reports = listed.json()
    assert any(report["id"] == report_id for report in reports)
    report = next(item for item in reports if item["id"] == report_id)
    assert report["status"] == "open"
    assert report["reporter_name"]
    assert report["target_label"]

    resolved = client.patch(
        f"/api/v1/admin/reports/{report_id}",
        headers=_auth_headers(admin_token),
        json={"status": "resolved"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"

    open_reports = client.get(
        "/api/v1/admin/reports",
        headers=_auth_headers(admin_token),
        params={"status": "open"},
    ).json()
    assert all(item["id"] != report_id for item in open_reports)


def test_admin_deactivates_and_reactivates_user(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    admin_token = _login_admin(client)

    with testing_session_local() as db:
        student_id = db.scalar(
            select(User.id).where(User.email == DEV_CREDENTIALS["student"]["email"])
        )
    assert student_id is not None

    deactivated = client.patch(
        f"/api/v1/admin/users/{student_id}",
        headers=_auth_headers(admin_token),
        json={"is_active": False},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    # Existing tokens stop working immediately and logins get the generic 401.
    me_response = client.get(
        "/api/v1/auth/me", headers=_auth_headers(student_token)
    )
    assert me_response.status_code == 403

    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": DEV_CREDENTIALS["student"]["email"],
            "password": DEV_CREDENTIALS["student"]["password"],
        },
    )
    assert login_response.status_code == 401
    assert login_response.json()["detail"] == "Invalid email or password"

    reactivated = client.patch(
        f"/api/v1/admin/users/{student_id}",
        headers=_auth_headers(admin_token),
        json={"is_active": True},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True


def test_admin_cannot_deactivate_self(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    admin_token = _login_admin(client)

    with testing_session_local() as db:
        admin_id = db.scalar(select(User.id).where(User.email == ADMIN_EMAIL))
    assert admin_id is not None

    response = client.patch(
        f"/api/v1/admin/users/{admin_id}",
        headers=_auth_headers(admin_token),
        json={"is_active": False},
    )

    assert response.status_code == 400


def test_admin_closes_any_opportunity(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    admin_token = _login_admin(client)

    with testing_session_local() as db:
        opportunity_id = db.scalar(
            select(Opportunity.id).where(Opportunity.status == "open")
        )
    assert opportunity_id is not None

    response = client.patch(
        f"/api/v1/admin/opportunities/{opportunity_id}",
        headers=_auth_headers(admin_token),
        json={"status": "closed"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "closed"

    with testing_session_local() as db:
        stored_status = db.scalar(
            select(Opportunity.status).where(Opportunity.id == opportunity_id)
        )
    assert stored_status == "closed"
