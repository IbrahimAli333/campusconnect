from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import verify_password
from app.db.base import Base
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.user import User
from app.models.user_profile import UserProfile
from app.scripts.provision_release_preview import (
    ALLOW_ENV_VALUE,
    ALLOW_ENV_VAR,
    CONFIRM_FLAG,
    RELEASE_TEST_CREDENTIALS,
    ReleasePreviewProvisioningRefused,
    provision_release_preview,
    main as provision_release_preview_main,
)


@pytest.fixture()
def testing_session_local() -> Iterator[sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    Base.metadata.create_all(bind=engine)

    try:
        yield session_local
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _table_counts(db: Session) -> dict[str, int]:
    table_names = [
        "universities",
        "faculties",
        "departments",
        "student_groups",
        "users",
        "teacher_profiles",
        "student_profiles",
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


def test_release_preview_provisioning_refuses_without_env_var(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = provision_release_preview_main([CONFIRM_FLAG], environ={})

    captured = capsys.readouterr()
    assert exit_code == 2
    assert ALLOW_ENV_VAR in captured.err


def test_release_preview_provisioning_refuses_without_confirmation_flag(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = provision_release_preview_main(
        [],
        environ={ALLOW_ENV_VAR: ALLOW_ENV_VALUE},
    )

    captured = capsys.readouterr()
    assert exit_code == 2
    assert CONFIRM_FLAG in captured.err


def test_release_preview_provisioning_function_requires_confirmed_safeguards(
    testing_session_local: sessionmaker[Session],
) -> None:
    with testing_session_local() as db:
        with pytest.raises(ReleasePreviewProvisioningRefused):
            provision_release_preview(db)


def test_release_preview_provisioning_creates_minimal_idempotent_data(
    testing_session_local: sessionmaker[Session],
) -> None:
    with testing_session_local() as db:
        first_summary = provision_release_preview(db, safeguards_confirmed=True)
        first_counts = _table_counts(db)

        application = db.get(
            OpportunityApplication,
            first_summary.teacher_research_application_id,
        )
        assert application is not None
        application.status = "reviewing"
        db.commit()

        second_summary = provision_release_preview(db, safeguards_confirmed=True)
        second_counts = _table_counts(db)

        assert first_summary == second_summary
        assert first_counts == second_counts
        assert second_counts == {
            "universities": 1,
            "faculties": 1,
            "departments": 1,
            "student_groups": 1,
            "users": 3,
            "teacher_profiles": 1,
            "student_profiles": 1,
            "user_profiles": 3,
            "skills": 11,
            "user_skills": 11,
            "resume_entries": 4,
            "opportunities": 2,
            "opportunity_applications": 1,
            "connection_requests": 0,
            "saved_opportunities": 0,
        }

        users_by_email = {
            user.email: user for user in db.scalars(select(User)).all()
        }
        assert set(users_by_email) == {
            values["email"] for values in RELEASE_TEST_CREDENTIALS.values()
        }
        for values in RELEASE_TEST_CREDENTIALS.values():
            user = users_by_email[values["email"]]
            assert user.full_name == values["full_name"]
            assert user.role == values["role"].value
            assert user.is_active is True
            assert user.hashed_password != values["password"]
            assert verify_password(values["password"], user.hashed_password)

        profiles_by_role = {
            profile.role: profile for profile in db.scalars(select(UserProfile)).all()
        }
        assert set(profiles_by_role) == {"member", "student", "teacher"}
        assert all(profile.visibility == "public" for profile in profiles_by_role.values())
        assert all(profile.headline for profile in profiles_by_role.values())
        assert all(profile.bio for profile in profiles_by_role.values())

        student_startup = db.scalar(
            select(Opportunity).where(
                Opportunity.title == "Campus Study Planner Cofounder"
            )
        )
        teacher_research = db.scalar(
            select(Opportunity).where(
                Opportunity.title == "Research Assistant for Learning Analytics Lab"
            )
        )
        assert student_startup is not None
        assert student_startup.type == "startup"
        assert student_startup.status == "open"
        assert student_startup.owner_profile_id == profiles_by_role["student"].id
        assert student_startup.owner_profile_id != profiles_by_role["member"].id
        assert teacher_research is not None
        assert teacher_research.type == "research"
        assert teacher_research.status == "open"
        assert teacher_research.owner_profile_id == profiles_by_role["teacher"].id

        teacher_review_application = db.get(
            OpportunityApplication,
            second_summary.teacher_research_application_id,
        )
        assert teacher_review_application is not None
        assert teacher_review_application.opportunity_id == teacher_research.id
        assert (
            teacher_review_application.applicant_profile_id
            == profiles_by_role["student"].id
        )
        assert teacher_review_application.status == "submitted"
        assert teacher_review_application.note

        for title in db.scalars(select(Opportunity.title)):
            normalized = " ".join(title.lower().split())
            assert normalized not in {"sad", "test", "testing", "qa"}
            assert "timestamp" not in normalized
