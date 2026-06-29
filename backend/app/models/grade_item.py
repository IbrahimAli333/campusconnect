from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GradeItem(Base):
    __tablename__ = "grade_items"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('assignment', 'quiz', 'exam', 'project', 'participation')",
            name="grade_item_kind",
        ),
        CheckConstraint("max_score >= 0", name="grade_item_max_score_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)
    due_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    course: Mapped["Course"] = relationship(back_populates="grade_items")
    grade_records: Mapped[list["GradeRecord"]] = relationship(
        back_populates="grade_item", cascade="all, delete-orphan"
    )
