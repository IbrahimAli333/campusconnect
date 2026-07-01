from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.opportunity import Opportunity
from app.models.skill import Skill
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


def _contains_key(value: Any, key: str) -> bool:
    if isinstance(value, dict):
        return key in value or any(_contains_key(item, key) for item in value.values())
    if isinstance(value, list):
        return any(_contains_key(item, key) for item in value)
    return False


def _profile_id_for_email(
    testing_session_local: sessionmaker[Session],
    email: str,
) -> int:
    with testing_session_local() as db:
        profile_id = db.scalar(
            select(UserProfile.id).join(User).where(User.email == email)
        )
    assert profile_id is not None
    return profile_id


def _opportunity_id_by_type(
    testing_session_local: sessionmaker[Session],
    opportunity_type: str,
) -> int:
    with testing_session_local() as db:
        opportunity_id = db.scalar(
            select(Opportunity.id)
            .where(Opportunity.type == opportunity_type)
            .order_by(Opportunity.id)
        )
    assert opportunity_id is not None
    return opportunity_id


def _skill_id_by_name(
    testing_session_local: sessionmaker[Session],
    name: str,
) -> int:
    with testing_session_local() as db:
        skill_id = db.scalar(select(Skill.id).where(Skill.name == name))
    assert skill_id is not None
    return skill_id


def test_authenticated_user_can_get_and_update_own_profile(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")

    me_response = client.get(
        "/api/v1/network/me",
        headers=_auth_headers(student_token),
    )
    update_response = client.patch(
        "/api/v1/network/me",
        headers=_auth_headers(student_token),
        json={
            "headline": "AI builder looking for research collaborators",
            "location": "Baku",
            "visibility": "university_only",
        },
    )

    assert me_response.status_code == 200
    assert me_response.json()["user"]["email"] == DEV_CREDENTIALS["student"]["email"]
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["headline"] == "AI builder looking for research collaborators"
    assert data["location"] == "Baku"
    assert data["visibility"] == "university_only"


def test_add_skill_creates_and_reuses_skill(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")

    create_response = client.post(
        "/api/v1/network/me/skills",
        headers=_auth_headers(student_token),
        json={"name": "Scientific Writing", "level": "intermediate"},
    )
    reuse_response = client.post(
        "/api/v1/network/me/skills",
        headers=_auth_headers(teacher_token),
        json={"name": "scientific writing", "level": "advanced"},
    )

    assert create_response.status_code == 201
    assert reuse_response.status_code == 201
    created = create_response.json()
    reused = reuse_response.json()
    assert created["skill"]["name"] == "Scientific Writing"
    assert reused["skill"]["id"] == created["skill"]["id"]
    assert reused["skill"]["id"] == _skill_id_by_name(
        testing_session_local,
        "Scientific Writing",
    )


def test_duplicate_skill_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")

    response = client.post(
        "/api/v1/network/me/skills",
        headers=_auth_headers(student_token),
        json={"name": "Python", "level": "expert"},
    )

    assert response.status_code == 409


def test_update_skill_level_works(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    create_response = client.post(
        "/api/v1/network/me/skills",
        headers=_auth_headers(student_token),
        json={"name": "GraphQL", "level": "beginner"},
    )
    user_skill_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/network/me/skills/{user_skill_id}",
        headers=_auth_headers(student_token),
        json={"level": "expert"},
    )

    assert create_response.status_code == 201
    assert update_response.status_code == 200
    assert update_response.json()["level"] == "expert"


def test_delete_skill_works(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    create_response = client.post(
        "/api/v1/network/me/skills",
        headers=_auth_headers(student_token),
        json={"name": "Technical Writing", "level": "intermediate"},
    )
    user_skill_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/api/v1/network/me/skills/{user_skill_id}",
        headers=_auth_headers(student_token),
    )
    list_response = client.get(
        "/api/v1/network/me/skills",
        headers=_auth_headers(student_token),
    )

    assert create_response.status_code == 201
    assert delete_response.status_code == 204
    assert all(item["id"] != user_skill_id for item in list_response.json())


def test_invalid_skill_level_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")

    response = client.post(
        "/api/v1/network/me/skills",
        headers=_auth_headers(student_token),
        json={"name": "Portfolio Review", "level": "guru"},
    )

    assert response.status_code == 422


def test_add_resume_entry_works(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")

    response = client.post(
        "/api/v1/network/me/resume",
        headers=_auth_headers(student_token),
        json={
            "entry_type": "project",
            "title": "Open Data Portfolio",
            "organization": "Campus Research Lab",
            "description": "Built a public data dashboard prototype.",
            "start_date": "2026-10-01",
            "end_date": None,
            "is_current": True,
            "url": "https://example.edu/open-data",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["entry_type"] == "project"
    assert data["title"] == "Open Data Portfolio"
    assert data["organization"] == "Campus Research Lab"
    assert data["start_date"] == "2026-10-01"
    assert data["is_current"] is True


def test_update_resume_entry_works(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    create_response = client.post(
        "/api/v1/network/me/resume",
        headers=_auth_headers(student_token),
        json={
            "entry_type": "research",
            "title": "Initial Research Title",
            "organization": "AI Lab",
            "description": "Initial description.",
            "start_date": "2026-09-01",
            "end_date": None,
            "is_current": True,
            "url": None,
        },
    )
    resume_entry_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/network/me/resume/{resume_entry_id}",
        headers=_auth_headers(student_token),
        json={
            "title": "Updated Research Portfolio",
            "description": "Updated portfolio description.",
            "is_current": False,
            "end_date": "2027-01-15",
        },
    )

    assert create_response.status_code == 201
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["title"] == "Updated Research Portfolio"
    assert data["description"] == "Updated portfolio description."
    assert data["is_current"] is False
    assert data["end_date"] == "2027-01-15"


def test_delete_resume_entry_works(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    create_response = client.post(
        "/api/v1/network/me/resume",
        headers=_auth_headers(student_token),
        json={
            "entry_type": "certification",
            "title": "Cloud Fundamentals",
            "organization": "Campus Lab",
            "description": None,
            "start_date": "2026-12-01",
            "end_date": "2026-12-15",
            "is_current": False,
            "url": None,
        },
    )
    resume_entry_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/api/v1/network/me/resume/{resume_entry_id}",
        headers=_auth_headers(student_token),
    )
    list_response = client.get(
        "/api/v1/network/me/resume",
        headers=_auth_headers(student_token),
    )

    assert create_response.status_code == 201
    assert delete_response.status_code == 204
    assert all(item["id"] != resume_entry_id for item in list_response.json())


def test_invalid_resume_entry_type_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")

    response = client.post(
        "/api/v1/network/me/resume",
        headers=_auth_headers(student_token),
        json={
            "entry_type": "publication",
            "title": "Unsupported Type",
            "organization": "Campus Lab",
            "description": None,
            "start_date": None,
            "end_date": None,
            "is_current": False,
            "url": None,
        },
    )

    assert response.status_code == 422


def test_profile_list_excludes_private_profiles_from_other_users(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["teacher"]["email"],
    )

    with testing_session_local() as db:
        teacher_profile = db.get(UserProfile, teacher_profile_id)
        assert teacher_profile is not None
        teacher_profile.visibility = "private"
        db.commit()

    response = client.get(
        "/api/v1/network/profiles",
        headers=_auth_headers(student_token),
    )

    assert response.status_code == 200
    profile_ids = {profile["id"] for profile in response.json()}
    assert teacher_profile_id not in profile_ids


def test_user_can_create_opportunity(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")

    response = client.post(
        "/api/v1/network/opportunities",
        headers=_auth_headers(student_token),
        json={
            "type": "project",
            "title": "Open Source Campus Map",
            "description": "Build a mobile map for labs, events, and study spaces.",
            "required_skills": ["React Native", "Product Design"],
            "status": "open",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Open Source Campus Map"
    assert data["owner_profile"]["user"]["email"] == DEV_CREDENTIALS["student"]["email"]


def test_student_cannot_create_research_opportunity(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    student_token = _login(client, "student")

    response = client.post(
        "/api/v1/network/opportunities",
        headers=_auth_headers(student_token),
        json={
            "type": "research",
            "title": "Unauthorized Research Assistant Role",
            "description": "Students should not post institutional research roles.",
            "required_skills": ["Research Methods"],
            "status": "open",
        },
    )

    assert response.status_code == 403
    assert "Student profiles can post only" in response.json()["detail"]


def test_teacher_can_create_research_opportunity(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")

    response = client.post(
        "/api/v1/network/opportunities",
        headers=_auth_headers(teacher_token),
        json={
            "type": "research",
            "title": "Research Assistant for Digital Archive Lab",
            "description": "Help prepare datasets for a faculty research group.",
            "required_skills": ["Python", "Research Methods"],
            "status": "open",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "research"
    assert data["owner_profile"]["user"]["email"] == DEV_CREDENTIALS["teacher"]["email"]


def test_member_can_browse_apply_and_connect_but_cannot_create_opportunities(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    member_token = _login(client, "member")
    student_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["student"]["email"],
    )
    research_opportunity_id = _opportunity_id_by_type(
        testing_session_local,
        "research",
    )

    me_response = client.get(
        "/api/v1/network/me",
        headers=_auth_headers(member_token),
    )
    profiles_response = client.get(
        "/api/v1/network/profiles",
        headers=_auth_headers(member_token),
    )
    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(member_token),
        json={"note": "Interested in joining as a community contributor."},
    )
    connect_response = client.post(
        f"/api/v1/network/connections/{student_profile_id}/request",
        headers=_auth_headers(member_token),
        json={"message": "Would like to follow your project updates."},
    )
    create_response = client.post(
        "/api/v1/network/opportunities",
        headers=_auth_headers(member_token),
        json={
            "type": "project",
            "title": "Member Should Not Post",
            "description": "Members should browse and apply, not publish posts.",
            "required_skills": ["Product Feedback"],
            "status": "open",
        },
    )

    assert me_response.status_code == 200
    assert me_response.json()["role"] == "member"
    assert profiles_response.status_code == 200
    assert apply_response.status_code == 201
    assert connect_response.status_code == 201
    assert create_response.status_code == 403
    assert create_response.json()["detail"] == "This profile role cannot post opportunities"


def test_user_can_apply_once_and_duplicate_application_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    opportunity_id = _opportunity_id_by_type(testing_session_local, "research")

    first_response = client.post(
        f"/api/v1/network/opportunities/{opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "I can help with Python experiments."},
    )
    duplicate_response = client.post(
        f"/api/v1/network/opportunities/{opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "Second attempt."},
    )

    assert first_response.status_code == 201
    assert first_response.json()["status"] == "submitted"
    assert duplicate_response.status_code == 409


def test_user_can_request_connection_once_and_duplicate_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["teacher"]["email"],
    )

    first_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
        json={"message": "Would like to discuss research mentorship."},
    )
    duplicate_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
        json={"message": "Trying again."},
    )

    assert first_response.status_code == 201
    assert first_response.json()["status"] == "pending"
    assert duplicate_response.status_code == 409


def test_user_can_save_opportunity_once_and_duplicate_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    opportunity_id = _opportunity_id_by_type(testing_session_local, "internship")

    first_response = client.post(
        f"/api/v1/network/opportunities/{opportunity_id}/save",
        headers=_auth_headers(student_token),
    )
    duplicate_response = client.post(
        f"/api/v1/network/opportunities/{opportunity_id}/save",
        headers=_auth_headers(student_token),
    )

    assert first_response.status_code == 201
    assert first_response.json()["opportunity_id"] == opportunity_id
    assert duplicate_response.status_code == 409


def test_applications_me_returns_current_user_applications_only(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    startup_opportunity_id = _opportunity_id_by_type(testing_session_local, "startup")

    student_apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "I can help with Python experiments."},
    )
    teacher_apply_response = client.post(
        f"/api/v1/network/opportunities/{startup_opportunity_id}/apply",
        headers=_auth_headers(teacher_token),
        json={"note": "I can advise the product direction."},
    )
    student_applications_response = client.get(
        "/api/v1/network/applications/me",
        headers=_auth_headers(student_token),
    )
    teacher_applications_response = client.get(
        "/api/v1/network/applications/me",
        headers=_auth_headers(teacher_token),
    )

    assert student_apply_response.status_code == 201
    assert teacher_apply_response.status_code == 201
    assert student_applications_response.status_code == 200
    assert teacher_applications_response.status_code == 200
    student_applications = student_applications_response.json()
    teacher_applications = teacher_applications_response.json()
    assert [item["opportunity"]["id"] for item in student_applications] == [
        research_opportunity_id
    ]
    assert [item["opportunity"]["id"] for item in teacher_applications] == [
        startup_opportunity_id
    ]
    assert student_applications[0]["status"] == "submitted"
    assert student_applications[0]["opportunity"]["type"] == "research"
    assert "owner_profile" in student_applications[0]["opportunity"]
    assert "created_at" in student_applications[0]


def test_owner_can_list_own_opportunities(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")

    response = client.get(
        "/api/v1/network/opportunities/mine",
        headers=_auth_headers(teacher_token),
    )

    assert response.status_code == 200
    opportunities = response.json()
    assert opportunities
    assert all(
        item["owner_profile"]["user"]["email"] == DEV_CREDENTIALS["teacher"]["email"]
        for item in opportunities
    )
    assert any(item["type"] == "research" for item in opportunities)


def test_owner_can_list_applications_for_owned_opportunity(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")

    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "I can help with Python experiments."},
    )
    response = client.get(
        f"/api/v1/network/opportunities/{research_opportunity_id}/applications",
        headers=_auth_headers(teacher_token),
    )

    assert apply_response.status_code == 201
    assert response.status_code == 200
    applications = response.json()
    assert len(applications) == 1
    application = applications[0]
    assert application["opportunity"]["id"] == research_opportunity_id
    assert application["applicant_profile"]["user"]["email"] == DEV_CREDENTIALS[
        "student"
    ]["email"]
    assert application["status"] == "submitted"
    assert application["note"] == "I can help with Python experiments."
    assert application["applicant_skills"]
    assert application["applicant_resume_entries"]


def test_non_owner_cannot_list_opportunity_applications(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")

    response = client.get(
        f"/api/v1/network/opportunities/{research_opportunity_id}/applications",
        headers=_auth_headers(student_token),
    )

    assert response.status_code == 403


def test_owner_can_update_application_status(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "Ready to review datasets."},
    )
    application_id = apply_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(teacher_token),
        json={"status": "accepted"},
    )

    assert apply_response.status_code == 201
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["id"] == application_id
    assert data["status"] == "accepted"
    assert data["opportunity"]["id"] == research_opportunity_id
    assert data["applicant_profile"]["user"]["email"] == DEV_CREDENTIALS["student"][
        "email"
    ]


def test_non_owner_cannot_update_application_status(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "Ready to review datasets."},
    )
    application_id = apply_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(student_token),
        json={"status": "reviewing"},
    )
    owner_response = client.get(
        f"/api/v1/network/opportunities/{research_opportunity_id}/applications",
        headers=_auth_headers(teacher_token),
    )

    assert apply_response.status_code == 201
    assert update_response.status_code == 403
    assert owner_response.status_code == 200
    assert owner_response.json()[0]["status"] == "submitted"


def test_invalid_owner_application_status_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "Ready to review datasets."},
    )
    application_id = apply_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(teacher_token),
        json={"status": "withdrawn"},
    )

    assert apply_response.status_code == 201
    assert update_response.status_code == 422


def test_opportunity_detail_includes_applied_and_saved_booleans(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    internship_opportunity_id = _opportunity_id_by_type(
        testing_session_local,
        "internship",
    )

    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "I can help with Python experiments."},
    )
    save_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/save",
        headers=_auth_headers(student_token),
    )
    applied_saved_response = client.get(
        f"/api/v1/network/opportunities/{research_opportunity_id}",
        headers=_auth_headers(student_token),
    )
    untouched_response = client.get(
        f"/api/v1/network/opportunities/{internship_opportunity_id}",
        headers=_auth_headers(student_token),
    )

    assert apply_response.status_code == 201
    assert save_response.status_code == 201
    assert applied_saved_response.status_code == 200
    assert untouched_response.status_code == 200
    applied_saved_data = applied_saved_response.json()
    untouched_data = untouched_response.json()
    assert applied_saved_data["id"] == research_opportunity_id
    assert applied_saved_data["has_applied"] is True
    assert applied_saved_data["has_saved"] is True
    assert applied_saved_data["required_skills"]
    assert applied_saved_data["owner_profile"]["user"]["email"] == DEV_CREDENTIALS[
        "teacher"
    ]["email"]
    assert untouched_data["has_applied"] is False
    assert untouched_data["has_saved"] is False


def test_opportunity_recommendations_exclude_owned_rank_skills_and_include_flags(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    internship_opportunity_id = _opportunity_id_by_type(
        testing_session_local,
        "internship",
    )

    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "I can help with Python and Azerbaijani NLP."},
    )
    save_response = client.post(
        f"/api/v1/network/opportunities/{internship_opportunity_id}/save",
        headers=_auth_headers(student_token),
    )
    response = client.get(
        "/api/v1/network/recommendations/opportunities",
        headers=_auth_headers(student_token),
    )

    assert apply_response.status_code == 201
    assert save_response.status_code == 201
    assert response.status_code == 200
    recommendations = response.json()
    assert recommendations
    assert all(
        item["owner_profile"]["user"]["email"] != DEV_CREDENTIALS["student"]["email"]
        for item in recommendations
    )
    assert all("match_score" in item for item in recommendations)
    assert all("match_reasons" in item for item in recommendations)
    assert all("has_applied" in item for item in recommendations)
    assert all("has_saved" in item for item in recommendations)

    by_title = {item["title"]: item for item in recommendations}
    research = by_title["Research Assistant for Azerbaijani NLP Lab"]
    internship = by_title["Backend Internship at Caspian Tech Lab"]
    assert research["match_score"] > internship["match_score"]
    assert research["has_applied"] is True
    assert internship["has_saved"] is True
    assert isinstance(research["match_reasons"], list)
    assert 0 <= research["match_score"] <= 100


def test_profile_recommendations_exclude_current_profile_and_include_status(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    student_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["student"]["email"],
    )
    teacher_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["teacher"]["email"],
    )

    connection_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
        json={"message": "Would like to discuss research mentorship."},
    )
    response = client.get(
        "/api/v1/network/recommendations/profiles",
        headers=_auth_headers(student_token),
    )

    assert connection_response.status_code == 201
    assert response.status_code == 200
    recommendations = response.json()
    assert recommendations
    assert all(item["id"] != student_profile_id for item in recommendations)
    assert all("match_score" in item for item in recommendations)
    assert all("match_reasons" in item for item in recommendations)
    assert all("connection_status" in item for item in recommendations)

    teacher_recommendation = next(
        item for item in recommendations if item["id"] == teacher_profile_id
    )
    assert teacher_recommendation["connection_status"] == "pending"
    assert isinstance(teacher_recommendation["match_reasons"], list)
    assert 0 <= teacher_recommendation["match_score"] <= 100


def test_connections_me_returns_current_user_sent_and_received_requests(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["teacher"]["email"],
    )
    student_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["student"]["email"],
    )

    request_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
        json={"message": "Would like to discuss research mentorship."},
    )
    student_connections_response = client.get(
        "/api/v1/network/connections/me",
        headers=_auth_headers(student_token),
    )
    teacher_connections_response = client.get(
        "/api/v1/network/connections/me",
        headers=_auth_headers(teacher_token),
    )

    assert request_response.status_code == 201
    assert student_connections_response.status_code == 200
    assert teacher_connections_response.status_code == 200
    student_connections = student_connections_response.json()
    teacher_connections = teacher_connections_response.json()
    assert len(student_connections["sent"]) == 1
    assert student_connections["sent"][0]["receiver_profile"]["id"] == teacher_profile_id
    assert student_connections["sent"][0]["status"] == "pending"
    assert student_connections["received"] == []
    assert teacher_connections["sent"] == []
    assert len(teacher_connections["received"]) == 1
    assert (
        teacher_connections["received"][0]["requester_profile"]["id"]
        == student_profile_id
    )


@pytest.mark.parametrize(
    ("method", "path", "json_body"),
    [
        ("get", "/api/v1/network/me", None),
        ("patch", "/api/v1/network/me", {"headline": "Blocked"}),
        ("get", "/api/v1/network/me/skills", None),
        (
            "post",
            "/api/v1/network/me/skills",
            {"name": "Blocked Skill", "level": "advanced"},
        ),
        ("patch", "/api/v1/network/me/skills/1", {"level": "expert"}),
        ("delete", "/api/v1/network/me/skills/1", None),
        ("get", "/api/v1/network/me/resume", None),
        (
            "post",
            "/api/v1/network/me/resume",
            {
                "entry_type": "project",
                "title": "Blocked Entry",
                "organization": "Blocked",
                "description": None,
                "start_date": None,
                "end_date": None,
                "is_current": False,
                "url": None,
            },
        ),
        ("patch", "/api/v1/network/me/resume/1", {"title": "Blocked"}),
        ("delete", "/api/v1/network/me/resume/1", None),
        ("get", "/api/v1/network/profiles", None),
        ("get", "/api/v1/network/recommendations/profiles", None),
        ("get", "/api/v1/network/profiles/1", None),
        ("get", "/api/v1/network/opportunities", None),
        ("get", "/api/v1/network/recommendations/opportunities", None),
        ("get", "/api/v1/network/opportunities/mine", None),
        ("get", "/api/v1/network/applications/me", None),
        ("patch", "/api/v1/network/applications/1", {"status": "reviewing"}),
        ("get", "/api/v1/network/opportunities/1", None),
        ("get", "/api/v1/network/opportunities/1/applications", None),
        ("get", "/api/v1/network/connections/me", None),
        (
            "post",
            "/api/v1/network/opportunities",
            {
                "type": "job",
                "title": "Blocked",
                "description": "Should require auth.",
                "required_skills": [],
                "status": "open",
            },
        ),
        ("post", "/api/v1/network/opportunities/1/apply", {"note": "Blocked"}),
        ("post", "/api/v1/network/connections/1/request", {"message": "Blocked"}),
        ("post", "/api/v1/network/opportunities/1/save", None),
    ],
)
def test_unauthenticated_network_requests_are_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    method: str,
    path: str,
    json_body: dict[str, Any] | None,
) -> None:
    client, _ = seeded_client_and_sessionmaker

    if json_body is None:
        response = getattr(client, method)(path)
    else:
        response = getattr(client, method)(path, json=json_body)

    assert response.status_code == 401


def test_network_responses_do_not_include_password_fields(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["teacher"]["email"],
    )
    research_opportunity_id = _opportunity_id_by_type(
        testing_session_local,
        "research",
    )
    internship_opportunity_id = _opportunity_id_by_type(
        testing_session_local,
        "internship",
    )
    application_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "Available for research support."},
    )
    assert application_response.status_code == 201
    application_id = application_response.json()["id"]

    responses = [
        client.get("/api/v1/network/me", headers=_auth_headers(student_token)),
        client.get("/api/v1/network/me/skills", headers=_auth_headers(student_token)),
        client.post(
            "/api/v1/network/me/skills",
            headers=_auth_headers(student_token),
            json={"name": "Security Research", "level": "beginner"},
        ),
        client.get("/api/v1/network/me/resume", headers=_auth_headers(student_token)),
        client.post(
            "/api/v1/network/me/resume",
            headers=_auth_headers(student_token),
            json={
                "entry_type": "award",
                "title": "Portfolio Review Finalist",
                "organization": "CampusConnect Lab",
                "description": "Recognized for a compact research portfolio.",
                "start_date": "2026-06-01",
                "end_date": None,
                "is_current": False,
                "url": None,
            },
        ),
        client.get("/api/v1/network/profiles", headers=_auth_headers(student_token)),
        client.get(
            "/api/v1/network/recommendations/profiles",
            headers=_auth_headers(student_token),
        ),
        client.get(
            f"/api/v1/network/profiles/{teacher_profile_id}",
            headers=_auth_headers(student_token),
        ),
        client.get(
            "/api/v1/network/opportunities",
            headers=_auth_headers(student_token),
        ),
        client.get(
            "/api/v1/network/recommendations/opportunities",
            headers=_auth_headers(student_token),
        ),
        client.get(
            "/api/v1/network/opportunities/mine",
            headers=_auth_headers(student_token),
        ),
        application_response,
        client.post(
            f"/api/v1/network/connections/{teacher_profile_id}/request",
            headers=_auth_headers(student_token),
            json={"message": "Open to mentorship."},
        ),
        client.post(
            f"/api/v1/network/opportunities/{internship_opportunity_id}/save",
            headers=_auth_headers(student_token),
        ),
        client.get(
            "/api/v1/network/applications/me",
            headers=_auth_headers(student_token),
        ),
        client.get(
            f"/api/v1/network/opportunities/{research_opportunity_id}/applications",
            headers=_auth_headers(teacher_token),
        ),
        client.patch(
            f"/api/v1/network/applications/{application_id}",
            headers=_auth_headers(teacher_token),
            json={"status": "reviewing"},
        ),
        client.get(
            f"/api/v1/network/opportunities/{research_opportunity_id}",
            headers=_auth_headers(student_token),
        ),
        client.get(
            "/api/v1/network/connections/me",
            headers=_auth_headers(student_token),
        ),
    ]

    for response in responses:
        assert response.status_code in {200, 201}
        data = response.json()
        assert not _contains_key(data, "hashed_password")
        assert not _contains_key(data, "password")


def test_receiver_can_accept_connection_request(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["teacher"]["email"],
    )
    request_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
        json={"message": "Mentorship request."},
    )
    connection_id = request_response.json()["id"]

    accept_response = client.patch(
        f"/api/v1/network/connections/{connection_id}",
        headers=_auth_headers(teacher_token),
        json={"status": "accepted"},
    )
    repeat_response = client.patch(
        f"/api/v1/network/connections/{connection_id}",
        headers=_auth_headers(teacher_token),
        json={"status": "declined"},
    )

    assert request_response.status_code == 201
    assert accept_response.status_code == 200
    assert accept_response.json()["status"] == "accepted"
    assert repeat_response.status_code == 400


def test_requester_cannot_accept_own_connection_request(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local,
        DEV_CREDENTIALS["teacher"]["email"],
    )
    request_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
        json={"message": "Mentorship request."},
    )
    connection_id = request_response.json()["id"]

    accept_response = client.patch(
        f"/api/v1/network/connections/{connection_id}",
        headers=_auth_headers(student_token),
        json={"status": "accepted"},
    )
    cancel_response = client.patch(
        f"/api/v1/network/connections/{connection_id}",
        headers=_auth_headers(student_token),
        json={"status": "canceled"},
    )

    assert accept_response.status_code == 403
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "canceled"


def test_owner_can_update_and_close_opportunity(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")

    non_owner_response = client.patch(
        f"/api/v1/network/opportunities/{research_opportunity_id}",
        headers=_auth_headers(student_token),
        json={"title": "Hijacked"},
    )
    owner_response = client.patch(
        f"/api/v1/network/opportunities/{research_opportunity_id}",
        headers=_auth_headers(teacher_token),
        json={"title": "Updated research title", "status": "closed"},
    )

    assert non_owner_response.status_code == 403
    assert owner_response.status_code == 200
    data = owner_response.json()
    assert data["title"] == "Updated research title"
    assert data["status"] == "closed"


def test_owner_cannot_change_opportunity_to_disallowed_type(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")

    response = client.patch(
        f"/api/v1/network/opportunities/{research_opportunity_id}",
        headers=_auth_headers(teacher_token),
        json={"type": "job"},
    )

    assert response.status_code == 403


def test_cannot_apply_to_closed_or_own_opportunity(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")

    own_apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(teacher_token),
        json={"note": "Applying to my own post."},
    )
    close_response = client.patch(
        f"/api/v1/network/opportunities/{research_opportunity_id}",
        headers=_auth_headers(teacher_token),
        json={"status": "closed"},
    )
    closed_apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "Too late."},
    )

    assert own_apply_response.status_code == 400
    assert close_response.status_code == 200
    assert closed_apply_response.status_code == 400


def test_user_can_unsave_opportunity(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    opportunity_id = _opportunity_id_by_type(testing_session_local, "internship")

    save_response = client.post(
        f"/api/v1/network/opportunities/{opportunity_id}/save",
        headers=_auth_headers(student_token),
    )
    unsave_response = client.delete(
        f"/api/v1/network/opportunities/{opportunity_id}/save",
        headers=_auth_headers(student_token),
    )
    repeat_unsave_response = client.delete(
        f"/api/v1/network/opportunities/{opportunity_id}/save",
        headers=_auth_headers(student_token),
    )

    assert save_response.status_code == 201
    assert unsave_response.status_code == 204
    assert repeat_unsave_response.status_code == 404


def test_applicant_can_withdraw_pending_application(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "First try."},
    )
    application_id = apply_response.json()["id"]

    non_applicant_withdraw = client.delete(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(teacher_token),
    )
    withdraw_response = client.delete(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(student_token),
    )
    reapply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "Second try after withdrawing."},
    )

    assert apply_response.status_code == 201
    assert non_applicant_withdraw.status_code == 404
    assert withdraw_response.status_code == 204
    assert reapply_response.status_code == 201


def test_applicant_cannot_withdraw_reviewed_application(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    research_opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    apply_response = client.post(
        f"/api/v1/network/opportunities/{research_opportunity_id}/apply",
        headers=_auth_headers(student_token),
        json={"note": "Please review."},
    )
    application_id = apply_response.json()["id"]
    client.patch(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(teacher_token),
        json={"status": "accepted"},
    )

    withdraw_response = client.delete(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(student_token),
    )

    assert withdraw_response.status_code == 400
