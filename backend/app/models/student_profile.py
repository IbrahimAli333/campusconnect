from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_student_profiles_user_id"),
        UniqueConstraint("student_number", name="uq_student_profiles_student_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    student_group_id: Mapped[int] = mapped_column(
        ForeignKey("student_groups.id", ondelete="RESTRICT"), nullable=False
    )
    student_number: Mapped[str] = mapped_column(String(50), nullable=False)
    enrollment_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="student_profile")
    student_group: Mapped["StudentGroup"] = relationship(back_populates="students")
    enrollments: Mapped[List["Enrollment"]] = relationship(
        back_populates="student_profile", cascade="all, delete-orphan"
    )
    attendance_records: Mapped[List["AttendanceRecord"]] = relationship(
        back_populates="student_profile", cascade="all, delete-orphan"
    )
    grade_records: Mapped[List["GradeRecord"]] = relationship(
        back_populates="student_profile", cascade="all, delete-orphan"
    )
