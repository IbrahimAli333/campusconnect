from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.department import Department
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
from app.models.student_group import StudentGroup
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.user import User, UserRole
from app.main import create_app
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


def _lesson_and_student(
    testing_session_local: sessionmaker[Session],
) -> tuple[int, int, int]:
    with testing_session_local() as db:
        row = db.execute(
            select(Lesson.id, StudentProfile.id, StudentProfile.user_id)
            .join(Enrollment, Enrollment.course_id == Lesson.course_id)
            .join(StudentProfile, StudentProfile.id == Enrollment.student_profile_id)
            .where(
                Enrollment.status == "active",
                StudentProfile.student_group_id == Lesson.group_id,
            )
            .order_by(Lesson.id, StudentProfile.id)
        ).first()

    assert row is not None
    lesson_id, student_profile_id, student_user_id = row
    return lesson_id, student_profile_id, student_user_id


def _create_other_teacher_lesson(
    testing_session_local: sessionmaker[Session],
) -> int:
    with testing_session_local() as db:
        department = db.scalar(select(Department).limit(1))
        group = db.scalar(select(StudentGroup).limit(1))
        assert department is not None
        assert group is not None

        teacher_user = User(
            email="other.teacher@example.edu",
            hashed_password=hash_password("teacher-password"),
            full_name="Other Teacher",
            role=UserRole.teacher.value,
            is_active=True,
        )
        db.add(teacher_user)
        db.flush()

        teacher_profile = TeacherProfile(
            user_id=teacher_user.id,
            department_id=department.id,
            teacher_number="T-DEV-002",
            title="Lecturer",
        )
        db.add(teacher_profile)
        db.flush()

        course = Course(
            department_id=department.id,
            teacher_profile_id=teacher_profile.id,
            code="OTHER101",
            title="Other Teacher Course",
            credits=3,
        )
        db.add(course)
        db.flush()

        lesson = Lesson(
            course_id=course.id,
            group_id=group.id,
            teacher_profile_id=teacher_profile.id,
            starts_at=datetime(2030, 9, 4, 9, 0, tzinfo=timezone.utc),
            ends_at=datetime(2030, 9, 4, 10, 30, tzinfo=timezone.utc),
            room="C-200",
            lesson_type="lecture",
        )
        db.add(lesson)
        db.commit()
        return lesson.id


def test_teacher_can_mark_attendance_for_own_lesson(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    lesson_id, student_profile_id, _ = _lesson_and_student(testing_session_local)

    response = client.put(
        f"/api/v1/attendance/lessons/{lesson_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "status": "absent"},
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["lesson"]["id"] == lesson_id
    assert data["attendance_summary"]["total"] == 1
    assert data["attendance_summary"]["absent"] == 1
    assert data["records"][0]["attendance_status"] == "absent"


def test_teacher_cannot_mark_attendance_for_another_teachers_lesson(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    lesson_id = _create_other_teacher_lesson(testing_session_local)
    _, student_profile_id, _ = _lesson_and_student(testing_session_local)

    response = client.put(
        f"/api/v1/attendance/lessons/{lesson_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "status": "present"},
            ],
        },
    )

    assert response.status_code == 403


def test_student_cannot_mark_attendance(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    lesson_id, student_profile_id, _ = _lesson_and_student(testing_session_local)

    response = client.put(
        f"/api/v1/attendance/lessons/{lesson_id}",
        headers=_auth_headers(student_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "status": "present"},
            ],
        },
    )

    assert response.status_code == 403


def test_unauthenticated_attendance_request_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    lesson_id, student_profile_id, _ = _lesson_and_student(testing_session_local)

    response = client.put(
        f"/api/v1/attendance/lessons/{lesson_id}",
        json={
            "records": [
                {"student_profile_id": student_profile_id, "status": "present"},
            ],
        },
    )

    assert response.status_code == 401


def test_invalid_attendance_status_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    lesson_id, student_profile_id, _ = _lesson_and_student(testing_session_local)

    response = client.put(
        f"/api/v1/attendance/lessons/{lesson_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "status": "missing"},
            ],
        },
    )

    assert response.status_code == 422


def test_repeated_attendance_submission_updates_without_duplicates(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    lesson_id, student_profile_id, student_user_id = _lesson_and_student(
        testing_session_local
    )

    first_response = client.put(
        f"/api/v1/attendance/lessons/{lesson_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "status": "absent"},
            ],
        },
    )
    second_response = client.put(
        f"/api/v1/attendance/lessons/{lesson_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_id": student_user_id, "status": "excused"},
            ],
        },
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    with testing_session_local() as db:
        records = db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.lesson_id == lesson_id,
                AttendanceRecord.student_profile_id == student_profile_id,
            )
        ).all()

    assert len(records) == 1
    assert records[0].status == "excused"
    assert second_response.json()["attendance_summary"]["excused"] == 1


def test_student_portal_reflects_updated_attendance(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    teacher_token = _login(client, "teacher")
    student_token = _login(client, "student")
    lesson_id, student_profile_id, _ = _lesson_and_student(testing_session_local)

    mark_response = client.put(
        f"/api/v1/attendance/lessons/{lesson_id}",
        headers=_auth_headers(teacher_token),
        json={
            "records": [
                {"student_profile_id": student_profile_id, "status": "absent"},
            ],
        },
    )
    portal_response = client.get(
        "/api/v1/portal/student",
        headers=_auth_headers(student_token),
    )

    assert mark_response.status_code == 200
    assert portal_response.status_code == 200
    data = portal_response.json()
    updated_record = next(
        record for record in data["attendance_records"] if record["lesson_id"] == lesson_id
    )
    assert updated_record["status"] == "absent"
    assert data["attendance_summary"]["total"] == 2
    assert data["attendance_summary"]["absent"] == 1
