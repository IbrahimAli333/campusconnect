from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="lesson_time_order"),
        CheckConstraint(
            "lesson_type IN ('lecture', 'seminar', 'lab', 'exam', 'practice')",
            name="lesson_type",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[int] = mapped_column(
        ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=False
    )
    teacher_profile_id: Mapped[int] = mapped_column(
        ForeignKey("teacher_profiles.id", ondelete="RESTRICT"), nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    room: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    lesson_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    course: Mapped["Course"] = relationship(back_populates="lessons")
    group: Mapped["StudentGroup"] = relationship(back_populates="lessons")
    teacher_profile: Mapped["TeacherProfile"] = relationship(back_populates="lessons")
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )
