from sqlalchemy import CheckConstraint, UniqueConstraint

import app.models  # noqa: F401
from app.db.base import Base


def _unique_columns(table_name: str) -> set[tuple[str, ...]]:
    table = Base.metadata.tables[table_name]
    return {
        tuple(constraint.columns.keys())
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }


def _check_constraint_names(table_name: str) -> set[str]:
    table = Base.metadata.tables[table_name]
    return {
        constraint.name
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    }


def test_model_metadata_includes_expected_tables() -> None:
    expected_tables = {
        "universities",
        "faculties",
        "departments",
        "users",
        "student_profiles",
        "teacher_profiles",
        "courses",
        "student_groups",
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
    }

    assert expected_tables.issubset(set(Base.metadata.tables.keys()))


def test_uniqueness_constraints_are_present() -> None:
    assert ("email",) in _unique_columns("users")
    assert ("student_number",) in _unique_columns("student_profiles")
    assert ("teacher_number",) in _unique_columns("teacher_profiles")
    assert ("department_id", "code") in _unique_columns("courses")
    assert ("student_profile_id", "course_id") in _unique_columns("enrollments")
    assert ("lesson_id", "student_profile_id") in _unique_columns(
        "attendance_records"
    )
    assert ("grade_item_id", "student_profile_id") in _unique_columns(
        "grade_records"
    )
    assert ("user_id",) in _unique_columns("user_profiles")
    assert ("name",) in _unique_columns("skills")
    assert ("profile_id", "skill_id") in _unique_columns("user_skills")
    assert ("opportunity_id", "applicant_profile_id") in _unique_columns(
        "opportunity_applications"
    )
    assert ("requester_profile_id", "receiver_profile_id") in _unique_columns(
        "connection_requests"
    )
    assert ("profile_id", "opportunity_id") in _unique_columns("saved_opportunities")


def test_academic_check_constraints_are_present() -> None:
    assert "ck_lessons_lesson_time_order" in _check_constraint_names("lessons")
    assert "ck_grade_items_grade_item_max_score_non_negative" in (
        _check_constraint_names("grade_items")
    )
    assert "ck_grade_records_grade_record_score_non_negative" in (
        _check_constraint_names("grade_records")
    )


def test_network_check_constraints_are_present() -> None:
    assert "ck_user_profiles_network_profile_role" in _check_constraint_names(
        "user_profiles"
    )
    assert "ck_user_skills_user_skill_level" in _check_constraint_names("user_skills")
    assert "ck_resume_entries_resume_entry_type" in _check_constraint_names(
        "resume_entries"
    )
    assert "ck_opportunities_opportunity_type" in _check_constraint_names(
        "opportunities"
    )
    assert "ck_opportunity_applications_opportunity_application_status" in (
        _check_constraint_names("opportunity_applications")
    )
    assert "ck_connection_requests_connection_request_not_self" in (
        _check_constraint_names("connection_requests")
    )


def test_users_table_includes_auth_columns() -> None:
    user_columns = set(Base.metadata.tables["users"].columns.keys())

    assert {
        "email",
        "hashed_password",
        "role",
        "is_active",
        "created_at",
        "updated_at",
    }.issubset(user_columns)
