from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GradeRecord(Base):
    __tablename__ = "grade_records"
    __table_args__ = (
        UniqueConstraint(
            "grade_item_id",
            "student_profile_id",
            name="uq_grade_records_item_student",
        ),
        CheckConstraint("score >= 0", name="grade_record_score_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    grade_item_id: Mapped[int] = mapped_column(
        ForeignKey("grade_items.id", ondelete="CASCADE"), nullable=False
    )
    student_profile_id: Mapped[int] = mapped_column(
        ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    graded_by_teacher_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("teacher_profiles.id", ondelete="SET NULL"), nullable=True
    )
    graded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    grade_item: Mapped["GradeItem"] = relationship(back_populates="grade_records")
    student_profile: Mapped["StudentProfile"] = relationship(
        back_populates="grade_records"
    )
    graded_by_teacher: Mapped[Optional["TeacherProfile"]] = relationship(
        back_populates="graded_records"
    )
