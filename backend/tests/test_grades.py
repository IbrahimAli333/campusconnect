from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Any

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
from app.models.course import Course
from app.models.department import Department
from app.models.enrollment import Enrollment
from app.models.grade_item import GradeItem
from app.models.grade_record import GradeRecord
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.user import User, UserRole
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


def _grade_item_and_student(
    testing_session_local: sessionmaker[Session],
) -> tuple[int, int, int, float]:
    with testing_session_local() as db:
        row = db.execute(
            select(
                GradeItem.id,
                StudentProfile.id,
                StudentProfile.user_id,
                GradeItem.max_score,
            )
            .join(Enrollment, Enrollment.course_id == GradeItem.course_id)
            .join(StudentProfile, StudentProfile.id == Enrollment.student_profile_id)
            .where(Enrollment.status == "active")
            .order_by(GradeItem.id, StudentProfile.id)
        ).first()

    assert row is not None
    grade_item_id, student_profile_id, student_user_id, max_score = row
    return grade_item_id, student_profile_id, student_user_id, max_score


def _create_other_teacher_grade_item(
    testing_session_local: sessionmaker[Session],
) -> int:
    with testing_session_local() as db:
        department = db.scalar(select(Department).limit(1))
        assert department is not None

        teacher_user = User(
            email="other.grade.teacher@example.edu",
            hashed_password=hash_password("teacher-password"),
            full_name="Other Grade Teacher",
            role=UserRole.teacher.value,
            is_active=True,
        )
        db.add(teacher_user)
        db.flush()

        teacher_profile = TeacherProfile(
            user_id=teacher_user.id,
            department_id=department.id,
            teacher_number="T-GRADE-002",
            title="Lecturer",
        )
        db.add(teacher_profile)
        db.flush()

        course = Course(
            department_id=department.id,
            teacher_profile_id=teacher_profile.id,
            code="OTHER-GRADE-101",
            title="Other Grade Course",
            credits=3,
        )
        db.add(course)
        db.flush()

        grade_item = GradeItem(
            course_id=course.id,
            title="Other Teacher Assignment",
            kind="assignment",
            max_score=100,
            due_at=datetime(2030, 9, 30, 23, 59, tzinfo=timezone.utc),
        )
        db.add(grade_item)
        db.commit()
        return grade_item.id


def test_teacher_can_enter_grades_for_own_course(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    grade_item_id, student_profile_id, _, _ = _grade_item_and_student(
        testing_session_local
    )

    response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {
                    "student_profile_id": student_profile_id,
                    "score": 91.5,
                    "comment": "Strong work",
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == grade_item_id
    assert data["graded_count"] == 1
    roster_row = next(
        row for row in data["roster"] if row["student_profile_id"] == student_profile_id
    )
    assert roster_row["score"] == 91.5
    assert roster_row["comment"] == "Strong work"


def test_teacher_cannot_enter_grades_for_another_teachers_course(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    other_grade_item_id = _create_other_teacher_grade_item(testing_session_local)
    _, student_profile_id, _, _ = _grade_item_and_student(testing_session_local)

    response = client.put(
        f"/api/v1/grades/items/{other_grade_item_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "score": 85},
            ],
        },
    )

    assert response.status_code == 403


def test_student_cannot_enter_grades(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    grade_item_id, student_profile_id, _, _ = _grade_item_and_student(
        testing_session_local
    )

    response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        headers=_auth_headers(student_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "score": 85},
            ],
        },
    )

    assert response.status_code == 403


def test_unauthenticated_grade_request_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    grade_item_id, student_profile_id, _, _ = _grade_item_and_student(
        testing_session_local
    )

    response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        json={
            "records": [
                {"student_profile_id": student_profile_id, "score": 85},
            ],
        },
    )

    assert response.status_code == 401


def test_score_below_zero_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    grade_item_id, student_profile_id, _, _ = _grade_item_and_student(
        testing_session_local
    )

    response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "score": -1},
            ],
        },
    )

    assert response.status_code == 400


def test_score_above_max_score_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    grade_item_id, student_profile_id, _, max_score = _grade_item_and_student(
        testing_session_local
    )

    response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "score": max_score + 1},
            ],
        },
    )

    assert response.status_code == 400


def test_repeated_grade_submission_updates_without_duplicates(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    grade_item_id, student_profile_id, student_user_id, _ = _grade_item_and_student(
        testing_session_local
    )

    first_response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "score": 74},
            ],
        },
    )
    second_response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_id": student_user_id, "score": 96, "comment": "Updated"},
            ],
        },
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    with testing_session_local() as db:
        records = db.scalars(
            select(GradeRecord).where(
                GradeRecord.grade_item_id == grade_item_id,
                GradeRecord.student_profile_id == student_profile_id,
            )
        ).all()

    assert len(records) == 1
    assert records[0].score == 96
    assert records[0].comment == "Updated"


def test_student_portal_reflects_updated_grades(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    student_token = _login(client, "student")
    grade_item_id, student_profile_id, _, _ = _grade_item_and_student(
        testing_session_local
    )

    update_response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {
                    "student_profile_id": student_profile_id,
                    "score": 93,
                    "comment": "Portal visible",
                },
            ],
        },
    )
    portal_response = client.get(
        "/api/v1/portal/student",
        headers=_auth_headers(student_token),
    )

    assert update_response.status_code == 200
    assert portal_response.status_code == 200
    data = portal_response.json()
    records = [
        record
        for summary in data["grades_summary"]
        for record in summary["records"]
        if record["grade_item_id"] == grade_item_id
    ]
    assert records
    assert records[0]["score"] == 93
    assert records[0]["comment"] == "Portal visible"


def test_teacher_portal_includes_grade_items_roster_and_scores(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")

    response = client.get(
        "/api/v1/portal/teacher",
        headers=_auth_headers(teacher_token),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["grade_items"]
    assert data["grade_items"][0]["roster"]
    assert any(
        row["score"] is not None
        for item in data["grade_items"]
        for row in item["roster"]
    )


def test_grade_responses_do_not_include_password_fields(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    student_token = _login(client, "student")
    grade_item_id, student_profile_id, _, _ = _grade_item_and_student(
        testing_session_local
    )

    grade_response = client.put(
        f"/api/v1/grades/items/{grade_item_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "score": 89},
            ],
        },
    )
    teacher_portal_response = client.get(
        "/api/v1/portal/teacher",
        headers=_auth_headers(teacher_token),
    )
    student_portal_response = client.get(
        "/api/v1/portal/student",
        headers=_auth_headers(student_token),
    )

    for response in (grade_response, teacher_portal_response, student_portal_response):
        assert response.status_code == 200
        data = response.json()
        assert not _contains_key(data, "hashed_password")
        assert not _contains_key(data, "password")
