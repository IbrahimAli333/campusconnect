"""Add academic portal tables.

Revision ID: 202606260003
Revises: 202606260002
Create Date: 2026-06-26
"""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606260003"
down_revision: Optional[str] = "202606260002"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("university_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("target_role", sa.String(length=30), nullable=False),
        sa.Column("priority", sa.String(length=30), nullable=False),
        sa.Column("published_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name="ck_announcements_announcement_priority",
        ),
        sa.CheckConstraint(
            "target_role IN ('all', 'admin', 'student', 'teacher', 'staff')",
            name="ck_announcements_announcement_target_role",
        ),
        sa.ForeignKeyConstraint(
            ["published_by_user_id"],
            ["users.id"],
            name="fk_announcements_published_by_user_id_users",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["universities.id"],
            name="fk_announcements_university_id_universities",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_announcements"),
    )
    op.create_table(
        "enrollments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_profile_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'dropped', 'withdrawn')",
            name="ck_enrollments_enrollment_status",
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="fk_enrollments_course_id_courses",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_profile_id"],
            ["student_profiles.id"],
            name="fk_enrollments_student_profile_id_student_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_enrollments"),
        sa.UniqueConstraint(
            "student_profile_id",
            "course_id",
            name="uq_enrollments_student_course",
        ),
    )
    op.create_table(
        "grade_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("max_score", sa.Float(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('assignment', 'quiz', 'exam', 'project', 'participation')",
            name="ck_grade_items_grade_item_kind",
        ),
        sa.CheckConstraint(
            "max_score >= 0",
            name="ck_grade_items_grade_item_max_score_non_negative",
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="fk_grade_items_course_id_courses",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_grade_items"),
    )
    op.create_table(
        "lessons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("teacher_profile_id", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("room", sa.String(length=120), nullable=True),
        sa.Column("lesson_type", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "ends_at > starts_at",
            name="ck_lessons_lesson_time_order",
        ),
        sa.CheckConstraint(
            "lesson_type IN ('lecture', 'seminar', 'lab', 'exam', 'practice')",
            name="ck_lessons_lesson_type",
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="fk_lessons_course_id_courses",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["student_groups.id"],
            name="fk_lessons_group_id_student_groups",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["teacher_profile_id"],
            ["teacher_profiles.id"],
            name="fk_lessons_teacher_profile_id_teacher_profiles",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_lessons"),
    )
    op.create_table(
        "materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("published_by_teacher_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('document', 'link', 'video', 'slides', 'repository')",
            name="ck_materials_material_kind",
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="fk_materials_course_id_courses",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["published_by_teacher_id"],
            ["teacher_profiles.id"],
            name="fk_materials_published_by_teacher_id_teacher_profiles",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_materials"),
    )
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("student_profile_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("marked_by_teacher_id", sa.Integer(), nullable=True),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('present', 'absent', 'late', 'excused')",
            name="ck_attendance_records_attendance_status",
        ),
        sa.ForeignKeyConstraint(
            ["lesson_id"],
            ["lessons.id"],
            name="fk_attendance_records_lesson_id_lessons",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["marked_by_teacher_id"],
            ["teacher_profiles.id"],
            name="fk_attendance_records_marked_by_teacher_id_teacher_profiles",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["student_profile_id"],
            ["student_profiles.id"],
            name="fk_attendance_records_student_profile_id_student_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_attendance_records"),
        sa.UniqueConstraint(
            "lesson_id",
            "student_profile_id",
            name="uq_attendance_records_lesson_student",
        ),
    )
    op.create_table(
        "grade_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("grade_item_id", sa.Integer(), nullable=False),
        sa.Column("student_profile_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("graded_by_teacher_id", sa.Integer(), nullable=True),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "score >= 0",
            name="ck_grade_records_grade_record_score_non_negative",
        ),
        sa.ForeignKeyConstraint(
            ["grade_item_id"],
            ["grade_items.id"],
            name="fk_grade_records_grade_item_id_grade_items",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["graded_by_teacher_id"],
            ["teacher_profiles.id"],
            name="fk_grade_records_graded_by_teacher_id_teacher_profiles",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["student_profile_id"],
            ["student_profiles.id"],
            name="fk_grade_records_student_profile_id_student_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_grade_records"),
        sa.UniqueConstraint(
            "grade_item_id",
            "student_profile_id",
            name="uq_grade_records_item_student",
        ),
    )


def downgrade() -> None:
    op.drop_table("grade_records")
    op.drop_table("attendance_records")
    op.drop_table("materials")
    op.drop_table("lessons")
    op.drop_table("grade_items")
    op.drop_table("enrollments")
    op.drop_table("announcements")
