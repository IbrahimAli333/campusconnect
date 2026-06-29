from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint(
            "university_id", "code", name="uq_departments_university_code"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    university_id: Mapped[int] = mapped_column(
        ForeignKey("universities.id", ondelete="CASCADE"), nullable=False
    )
    faculty_id: Mapped[int] = mapped_column(
        ForeignKey("faculties.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    university: Mapped["University"] = relationship(back_populates="departments")
    faculty: Mapped["Faculty"] = relationship(back_populates="departments")
    student_groups: Mapped[List["StudentGroup"]] = relationship(
        back_populates="department", cascade="all, delete-orphan"
    )
    teacher_profiles: Mapped[List["TeacherProfile"]] = relationship(
        back_populates="department"
    )
    courses: Mapped[List["Course"]] = relationship(
        back_populates="department", cascade="all, delete-orphan"
    )
