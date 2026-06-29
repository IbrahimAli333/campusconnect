from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("department_id", "code", name="uq_courses_department_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    teacher_profile_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("teacher_profiles.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    credits: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    department: Mapped["Department"] = relationship(back_populates="courses")
    teacher_profile: Mapped[Optional["TeacherProfile"]] = relationship(
        back_populates="courses"
    )
    enrollments: Mapped[List["Enrollment"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    lessons: Mapped[List["Lesson"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    grade_items: Mapped[List["GradeItem"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    materials: Mapped[List["Material"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
