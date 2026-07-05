from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.content_report import ContentReport
from app.models.user import User
from app.models.user_profile import UserProfile
from app.scripts.seed_dev import DEV_CREDENTIALS, seed_dev


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


def _my_profile_id(client: TestClient, token: str) -> int:
    response = client.get("/api/v1/network/me", headers=_auth_headers(token))
    assert response.status_code == 200
    return response.json()["id"]


def _profile_id_by_email(client: TestClient, token: str, email: str) -> int:
    response = client.get("/api/v1/network/profiles", headers=_auth_headers(token))
    assert response.status_code == 200
    for profile in response.json():
        if profile["user"]["email"] == email:
            return profile["id"]
    raise AssertionError(f"Profile for {email} not found")


class TestAccountDeletion:
    def test_delete_account_requires_correct_password(
        self, seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, _ = seeded_client_and_sessionmaker
        token = _login(client, "member")

        response = client.post(
            "/api/v1/auth/delete-account",
            headers=_auth_headers(token),
            json={"password": "wrong-password"},
        )
        assert response.status_code == 400

        response = client.get("/api/v1/auth/me", headers=_auth_headers(token))
        assert response.status_code == 200

    def test_delete_account_removes_user_and_network_data(
        self, seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = seeded_client_and_sessionmaker
        token = _login(client, "member")
        member_email = DEV_CREDENTIALS["member"]["email"]

        response = client.post(
            "/api/v1/auth/delete-account",
            headers=_auth_headers(token),
            json={"password": DEV_CREDENTIALS["member"]["password"]},
        )
        assert response.status_code == 204

        # The credentials no longer work and the token is dead.
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": member_email,
                "password": DEV_CREDENTIALS["member"]["password"],
            },
        )
        assert response.status_code == 401
        response = client.get("/api/v1/auth/me", headers=_auth_headers(token))
        assert response.status_code == 401

        with session_local() as db:
            assert db.scalar(select(User).where(User.email == member_email)) is None
            orphan_profiles = db.scalars(
                select(UserProfile).where(
                    UserProfile.user_id.not_in(select(User.id))
                )
            ).all()
            assert orphan_profiles == []

        # Other accounts no longer see the deleted member anywhere.
        teacher_token = _login(client, "teacher")
        response = client.get(
            "/api/v1/network/profiles", headers=_auth_headers(teacher_token)
        )
        assert response.status_code == 200
        emails = [profile["user"]["email"] for profile in response.json()]
        assert member_email not in emails


class TestContentReports:
    def test_report_profile_and_opportunity(
        self, seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = seeded_client_and_sessionmaker
        member_token = _login(client, "member")
        teacher_email = DEV_CREDENTIALS["teacher"]["email"]
        teacher_profile_id = _profile_id_by_email(client, member_token, teacher_email)

        response = client.post(
            "/api/v1/network/reports",
            headers=_auth_headers(member_token),
            json={
                "target_type": "profile",
                "target_id": teacher_profile_id,
                "reason": "Spam headline",
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert body["target_type"] == "profile"
        assert body["target_id"] == teacher_profile_id

        # Duplicate reports are rejected.
        response = client.post(
            "/api/v1/network/reports",
            headers=_auth_headers(member_token),
            json={"target_type": "profile", "target_id": teacher_profile_id},
        )
        assert response.status_code == 409

        # Report an opportunity too.
        response = client.get(
            "/api/v1/network/opportunities", headers=_auth_headers(member_token)
        )
        assert response.status_code == 200
        opportunity_id = response.json()[0]["id"]
        response = client.post(
            "/api/v1/network/reports",
            headers=_auth_headers(member_token),
            json={"target_type": "opportunity", "target_id": opportunity_id},
        )
        assert response.status_code == 201

        with session_local() as db:
            assert db.scalar(select(ContentReport)) is not None

    def test_cannot_report_own_content_or_missing_target(
        self, seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, _ = seeded_client_and_sessionmaker
        member_token = _login(client, "member")
        my_profile_id = _my_profile_id(client, member_token)

        response = client.post(
            "/api/v1/network/reports",
            headers=_auth_headers(member_token),
            json={"target_type": "profile", "target_id": my_profile_id},
        )
        assert response.status_code == 400

        response = client.post(
            "/api/v1/network/reports",
            headers=_auth_headers(member_token),
            json={"target_type": "profile", "target_id": 99999},
        )
        assert response.status_code == 404


class TestProfileBlocks:
    def test_block_hides_both_directions_and_unblock_restores(
        self, seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, _ = seeded_client_and_sessionmaker
        member_token = _login(client, "member")
        student_token = _login(client, "student")
        student_email = DEV_CREDENTIALS["student"]["email"]
        member_email = DEV_CREDENTIALS["member"]["email"]
        student_profile_id = _profile_id_by_email(client, member_token, student_email)

        response = client.post(
            f"/api/v1/network/blocks/{student_profile_id}",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 201

        # Duplicate block is rejected.
        response = client.post(
            f"/api/v1/network/blocks/{student_profile_id}",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 409

        # Member no longer sees the student.
        response = client.get(
            "/api/v1/network/profiles", headers=_auth_headers(member_token)
        )
        emails = [profile["user"]["email"] for profile in response.json()]
        assert student_email not in emails

        response = client.get(
            f"/api/v1/network/profiles/{student_profile_id}",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 404

        # The student no longer sees the member either.
        response = client.get(
            "/api/v1/network/profiles", headers=_auth_headers(student_token)
        )
        emails = [profile["user"]["email"] for profile in response.json()]
        assert member_email not in emails

        # The student's open posts disappear from the member's feed.
        response = client.get(
            "/api/v1/network/opportunities", headers=_auth_headers(member_token)
        )
        owner_ids = [
            opportunity["owner_profile"]["id"] for opportunity in response.json()
        ]
        assert student_profile_id not in owner_ids

        # Blocked list shows the student.
        response = client.get(
            "/api/v1/network/blocks/me", headers=_auth_headers(member_token)
        )
        assert response.status_code == 200
        assert [profile["id"] for profile in response.json()] == [student_profile_id]

        # Unblock restores visibility.
        response = client.delete(
            f"/api/v1/network/blocks/{student_profile_id}",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 204
        response = client.get(
            "/api/v1/network/profiles", headers=_auth_headers(member_token)
        )
        emails = [profile["user"]["email"] for profile in response.json()]
        assert student_email in emails

    def test_block_rejects_self_and_missing_profile(
        self, seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, _ = seeded_client_and_sessionmaker
        member_token = _login(client, "member")
        my_profile_id = _my_profile_id(client, member_token)

        response = client.post(
            f"/api/v1/network/blocks/{my_profile_id}",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 400

        response = client.post(
            "/api/v1/network/blocks/99999",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 404

        response = client.delete(
            "/api/v1/network/blocks/99999",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 404

    def test_block_prevents_connection_requests_and_applications(
        self, seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, _ = seeded_client_and_sessionmaker
        member_token = _login(client, "member")
        teacher_token = _login(client, "teacher")
        teacher_email = DEV_CREDENTIALS["teacher"]["email"]
        member_email = DEV_CREDENTIALS["member"]["email"]
        teacher_profile_id = _profile_id_by_email(client, member_token, teacher_email)
        member_profile_id = _profile_id_by_email(client, teacher_token, member_email)

        # Find an opportunity owned by the teacher before blocking.
        response = client.get(
            "/api/v1/network/opportunities", headers=_auth_headers(member_token)
        )
        teacher_opportunity_ids = [
            opportunity["id"]
            for opportunity in response.json()
            if opportunity["owner_profile"]["id"] == teacher_profile_id
            and opportunity["status"] == "open"
        ]
        assert teacher_opportunity_ids
        teacher_opportunity_id = teacher_opportunity_ids[0]

        response = client.post(
            f"/api/v1/network/blocks/{teacher_profile_id}",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 201

        # Neither side can send a connection request.
        response = client.post(
            f"/api/v1/network/connections/{member_profile_id}/request",
            headers=_auth_headers(teacher_token),
        )
        assert response.status_code == 404
        response = client.post(
            f"/api/v1/network/connections/{teacher_profile_id}/request",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 404

        # The blocker cannot apply to the blocked user's opportunity.
        response = client.post(
            f"/api/v1/network/opportunities/{teacher_opportunity_id}/apply",
            headers=_auth_headers(member_token),
        )
        assert response.status_code == 404
