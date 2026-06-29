from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


APPLICATION_STATUSES = (
    "submitted",
    "reviewing",
    "accepted",
    "rejected",
    "withdrawn",
)


class OpportunityApplication(Base):
    __tablename__ = "opportunity_applications"
    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted', 'reviewing', 'accepted', 'rejected', "
            "'withdrawn')",
            name="opportunity_application_status",
        ),
        UniqueConstraint(
            "opportunity_id",
            "applicant_profile_id",
            name="uq_opportunity_applications_opportunity_applicant",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False
    )
    applicant_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="submitted", nullable=False
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    opportunity: Mapped["Opportunity"] = relationship(back_populates="applications")
    applicant_profile: Mapped["UserProfile"] = relationship(
        back_populates="applications"
    )
