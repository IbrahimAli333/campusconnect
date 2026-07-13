from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


CONTENT_REPORT_TARGET_TYPES = ("profile", "opportunity")
CONTENT_REPORT_STATUSES = ("open", "resolved", "dismissed")


class ContentReport(Base):
    __tablename__ = "content_reports"
    __table_args__ = (
        CheckConstraint(
            "target_type IN ('profile', 'opportunity')",
            name="content_report_target_type",
        ),
        CheckConstraint(
            "status IN ('open', 'resolved', 'dismissed')",
            name="content_report_status",
        ),
        CheckConstraint(
            "(target_type = 'profile' AND target_profile_id IS NOT NULL AND target_opportunity_id IS NULL)"
            " OR (target_type = 'opportunity' AND target_opportunity_id IS NOT NULL AND target_profile_id IS NULL)",
            name="content_report_target_consistency",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    target_type: Mapped[str] = mapped_column(String(30), nullable=False)
    target_profile_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=True
    )
    target_opportunity_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="open", server_default="open", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reporter_profile: Mapped["UserProfile"] = relationship(
        back_populates="filed_reports",
        foreign_keys=[reporter_profile_id],
    )
    target_profile: Mapped[Optional["UserProfile"]] = relationship(
        back_populates="reports_against",
        foreign_keys=[target_profile_id],
    )
    target_opportunity: Mapped[Optional["Opportunity"]] = relationship(
        back_populates="reports",
    )
