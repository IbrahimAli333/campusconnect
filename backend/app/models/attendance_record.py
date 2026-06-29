from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint(
            "lesson_id",
            "student_profile_id",
            name="uq_attendance_records_lesson_student",
        ),
        CheckConstraint(
            "status IN ('present', 'absent', 'late', 'excused')",
            name="attendance_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    student_profile_id: Mapped[int] = mapped_column(
        ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    marked_by_teacher_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("teacher_profiles.id", ondelete="SET NULL"), nullable=True
    )
    marked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    lesson: Mapped["Lesson"] = relationship(back_populates="attendance_records")
    student_profile: Mapped["StudentProfile"] = relationship(
        back_populates="attendance_records"
    )
    marked_by_teacher: Mapped[Optional["TeacherProfile"]] = relationship(
        back_populates="marked_attendance_records"
    )
