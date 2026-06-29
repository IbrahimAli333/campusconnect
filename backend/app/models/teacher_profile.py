from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_teacher_profiles_user_id"),
        UniqueConstraint("teacher_number", name="uq_teacher_profiles_teacher_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False
    )
    teacher_number: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="teacher_profile")
    department: Mapped["Department"] = relationship(back_populates="teacher_profiles")
    courses: Mapped[List["Course"]] = relationship(back_populates="teacher_profile")
    lessons: Mapped[List["Lesson"]] = relationship(back_populates="teacher_profile")
    marked_attendance_records: Mapped[List["AttendanceRecord"]] = relationship(
        back_populates="marked_by_teacher"
    )
    graded_records: Mapped[List["GradeRecord"]] = relationship(
        back_populates="graded_by_teacher"
    )
    published_materials: Mapped[List["Material"]] = relationship(
        back_populates="published_by_teacher"
    )
