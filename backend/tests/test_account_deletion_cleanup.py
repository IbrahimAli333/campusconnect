"""Synthetic fixtures with enforced constraints on SQLite or dedicated local PostgreSQL."""
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, sessionmaker
from deletion_test_database import assert_foreign_keys, deletion_test_engine

import app.models  # noqa: F401
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.models.announcement import Announcement
from app.models.connection_request import ConnectionRequest
from app.models.content_report import ContentReport
from app.models.course import Course
from app.models.grade_record import GradeRecord
from app.models.material import Material
from app.models.message import Message
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.profile_block import ProfileBlock
from app.models.push_token import PushToken
from app.models.saved_opportunity import SavedOpportunity
from app.models.teacher_profile import TeacherProfile
from app.models.university import University
from app.models.user import User
from app.models.user_profile import UserProfile
from app.scripts.seed_dev import DEV_CREDENTIALS, seed_dev
from app.services.account_deletion import delete_user_account


@pytest.fixture()
def cleanup_db(monkeypatch: pytest.MonkeyPatch) -> Iterator[sessionmaker[Session]]:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("UNIVERSITY_PORTAL_ENVIRONMENT", "test")
    for key in ("SENTRY_DSN", "ANTHROPIC_API_KEY", "SMTP_HOST", "SMTP_FROM"):
        monkeypatch.setenv(f"UNIVERSITY_PORTAL_{key}", "")
    get_settings.cache_clear()
    try:
        with deletion_test_engine() as engine:
            sessions = sessionmaker(bind=engine, autoflush=False)
            Base.metadata.create_all(engine)
            with sessions() as db:
                assert_foreign_keys(db)
                seed_dev(db)
            yield sessions
    finally:
        get_settings.cache_clear()


def teacher(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == DEV_CREDENTIALS["teacher"]["email"]))
    assert user is not None and user.teacher_profile is not None
    return user


def content_fixture(db: Session) -> dict[str, int]:
    owner = teacher(db)
    university = db.scalars(select(University)).first()
    course = db.scalars(select(Course)).first()
    assert university is not None and course is not None
    other = User(
        email="unrelated-cleanup@example.test", full_name="Unrelated fixture teacher",
        hashed_password=hash_password("synthetic-password"), role="teacher",
    )
    other.teacher_profile = TeacherProfile(
        department_id=owner.teacher_profile.department_id, teacher_number="cleanup-other",
    )
    db.add(other)
    db.flush()
    authored = Announcement(
        university_id=university.id, published_by_user_id=owner.id,
        title="Deleting author's identifying title", body="Deleting author's text",
        target_role="all",
    )
    unrelated = Announcement(
        university_id=university.id, published_by_user_id=other.id,
        title="Other author's title", body="Keep this unrelated text", target_role="all",
    )
    own_material = Material(
        course_id=course.id, published_by_teacher_id=owner.teacher_profile.id,
        title="Deleting author's listing", kind="link",
        url="https://example.test/deleting-author",
    )
    unrelated_material = Material(
        course_id=course.id, published_by_teacher_id=other.teacher_profile.id,
        title="Unrelated listing", kind="link", url="https://example.test/unrelated",
    )
    unowned_material = Material(
        course_id=course.id, title="Institutional listing", kind="link",
        url="https://example.test/institutional",
    )
    db.add_all([authored, unrelated, own_material, unrelated_material, unowned_material])
    db.commit()
    return {
        "owner": owner.id, "other": other.id, "course": course.id,
        "announcement": authored.id, "other_announcement": unrelated.id,
        "material": own_material.id, "other_material": unrelated_material.id,
        "unowned_material": unowned_material.id,
    }


@pytest.mark.parametrize("preload_relationships", [False, True])
def test_cleanup_removes_owned_content_preserves_unrelated_and_shared_records(
    cleanup_db: sessionmaker[Session], preload_relationships: bool,
) -> None:
    with cleanup_db() as db:
        ids = content_fixture(db)
        owner = db.get(User, ids["owner"])
        assert owner is not None
        courses_before = set(db.scalars(select(Course.id)))
        grades_before = set(db.scalars(select(GradeRecord.id)))
        users_before = set(db.scalars(select(User.id)))
        teacher_profile_id = owner.teacher_profile.id
        if preload_relationships:
            list(owner.published_announcements)
            list(owner.teacher_profile.published_materials)
            list(owner.teacher_profile.courses)
        delete_user_account(db, owner)
        db.commit()
    with cleanup_db() as db:
        assert db.get(User, ids["owner"]) is None
        assert db.get(Announcement, ids["announcement"]) is None
        assert db.get(Material, ids["material"]) is None
        assert db.get(Announcement, ids["other_announcement"]).body == "Keep this unrelated text"
        assert db.get(Material, ids["other_material"]).url == "https://example.test/unrelated"
        assert db.get(Material, ids["unowned_material"]) is not None
        assert set(db.scalars(select(Course.id))) == courses_before
        assert set(db.scalars(select(GradeRecord.id))) == grades_before
        assert db.get(TeacherProfile, teacher_profile_id) is None
        assert set(db.scalars(select(User.id))) == users_before - {ids["owner"]}
        assert_foreign_keys(db)


def test_cleanup_preserves_network_cascades_and_reassigned_token(
    cleanup_db: sessionmaker[Session],
) -> None:
    with cleanup_db() as db:
        owner = teacher(db)
        owner_id = owner.id
        profile = owner.network_profile
        member = db.scalar(select(User).where(User.email == DEV_CREDENTIALS["member"]["email"]))
        assert profile is not None and member is not None
        other_profile = member.network_profile
        assert other_profile is not None
        own_post = Opportunity(
            owner_profile_id=profile.id, type="project", title="Synthetic owned post",
            description="Synthetic content",
        )
        other_post = Opportunity(
            owner_profile_id=other_profile.id, type="project",
            title="Synthetic unrelated post", description="Keep",
        )
        db.add_all([own_post, other_post])
        db.flush()
        dependent = [
            OpportunityApplication(opportunity_id=own_post.id, applicant_profile_id=other_profile.id),
            OpportunityApplication(opportunity_id=other_post.id, applicant_profile_id=profile.id),
            SavedOpportunity(opportunity_id=own_post.id, profile_id=other_profile.id),
            Message(sender_profile_id=profile.id, recipient_profile_id=other_profile.id, body="Outgoing"),
            Message(sender_profile_id=other_profile.id, recipient_profile_id=profile.id, body="Incoming"),
            ConnectionRequest(requester_profile_id=profile.id, receiver_profile_id=other_profile.id),
            ProfileBlock(blocker_profile_id=other_profile.id, blocked_profile_id=profile.id),
            ContentReport(reporter_profile_id=other_profile.id, target_type="profile", target_profile_id=profile.id),
            PushToken(user_id=owner_id, token="fixture-device-one", platform="android"),
            PushToken(user_id=owner_id, token="fixture-device-two", platform="android"),
        ]
        reassigned = PushToken(user_id=owner_id, token="fixture-reassigned", platform="android")
        db.add_all([*dependent, reassigned])
        db.commit()
        reassigned.user_id = member.id  # Another user completed token registration.
        db.commit()
        removed = [(type(record), record.id) for record in dependent]
        profile_id, own_post_id, other_post_id = profile.id, own_post.id, other_post.id
        reassigned_id, member_id = reassigned.id, member.id
        db.expire_all()
        delete_user_account(db, db.get(User, owner_id))
        db.commit()
    with cleanup_db() as db:
        assert db.get(UserProfile, profile_id) is None
        assert db.get(Opportunity, own_post_id) is None
        assert db.get(Opportunity, other_post_id) is not None
        for model, record_id in removed:
            assert db.get(model, record_id) is None
        assert db.get(PushToken, reassigned_id).user_id == member_id
        assert db.get(User, member_id) is not None
        assert_foreign_keys(db)


def test_caller_rollback_restores_authored_content_and_account(
    cleanup_db: sessionmaker[Session],
) -> None:
    with cleanup_db() as db:
        ids = content_fixture(db)
        before = {
            table.name: db.scalar(select(func.count()).select_from(table))
            for table in Base.metadata.sorted_tables
        }
        delete_user_account(db, db.get(User, ids["owner"]))
        assert db.get(Announcement, ids["announcement"]) is None
        db.rollback()  # A later caller operation fails; service must not commit.
    with cleanup_db() as db:
        assert db.get(User, ids["owner"]) is not None
        assert db.get(Announcement, ids["announcement"]).body == "Deleting author's text"
        assert db.get(Material, ids["material"]).url == "https://example.test/deleting-author"
        after = {
            table.name: db.scalar(select(func.count()).select_from(table))
            for table in Base.metadata.sorted_tables
        }
        assert after == before


def test_stale_loaded_relationships_do_not_delete_reassigned_records(cleanup_db):
    with cleanup_db() as db:
        ids = content_fixture(db)
        owner = db.get(User, ids["owner"])
        other = db.get(User, ids["other"])
        token = PushToken(user_id=owner.id, token="fixture-stale-reassigned", platform="android")
        db.add(token)
        db.commit()
        token_id = token.id
        list(owner.push_tokens)
        list(owner.published_announcements)
        list(owner.teacher_profile.published_materials)
        other_teacher_id = other.teacher_profile.id
        # Model a database change that this Session's loaded collections have
        # not observed; the deletion helper must refresh current ownership.
        for model, record_id, values in [
            (PushToken, token_id, {"user_id": other.id}),
            (Announcement, ids["announcement"], {"published_by_user_id": other.id}),
            (Material, ids["material"], {"published_by_teacher_id": other_teacher_id}),
        ]:
            db.execute(update(model).where(model.id == record_id).values(**values)
                       .execution_options(synchronize_session=False))
        delete_user_account(db, owner)
        db.commit()
    with cleanup_db() as db:
        assert db.get(User, ids["owner"]) is None
        assert db.get(PushToken, token_id).user_id == ids["other"]
        assert db.get(Announcement, ids["announcement"]).published_by_user_id == ids["other"]
        assert db.get(Material, ids["material"]).published_by_teacher_id == other_teacher_id


def test_api_preserves_credentials_response_and_revokes_old_tokens(
    cleanup_db: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Telemetry is disabled before these imports. Every request overrides get_db.
    from app.db.session import get_db
    from app.main import create_app

    monkeypatch.setenv("UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE", "true")
    get_settings.cache_clear()
    with cleanup_db() as db:
        ids = content_fixture(db)
    app = create_app()

    def override_get_db() -> Iterator[Session]:
        with cleanup_db() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json=DEV_CREDENTIALS["teacher"])
        assert login.status_code == 200
        tokens = login.json()
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        for payload, expected_status in [({"password": "incorrect"}, 400), ({}, 422)]:
            response = client.post("/api/v1/auth/delete-account", headers=headers, json=payload)
            assert response.status_code == expected_status
            with cleanup_db() as db:
                assert db.get(Announcement, ids["announcement"]) is not None
                assert db.get(Material, ids["material"]) is not None
        response = client.post(
            "/api/v1/auth/delete-account", headers=headers,
            json={"password": DEV_CREDENTIALS["teacher"]["password"]},
        )
        assert response.status_code == 204 and response.content == b""
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
        assert client.post(
            "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]},
        ).status_code == 401
        assert client.post("/api/v1/auth/login", json=DEV_CREDENTIALS["teacher"]).status_code == 401
    with cleanup_db() as db:
        assert db.get(Announcement, ids["announcement"]) is None
        assert db.get(Material, ids["material"]) is None
        assert db.get(User, ids["other"]) is not None
