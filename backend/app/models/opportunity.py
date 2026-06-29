from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


OPPORTUNITY_TYPES = ("startup", "research", "internship", "job", "project")
OPPORTUNITY_STATUSES = ("draft", "open", "closed", "archived")


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (
        CheckConstraint(
            "type IN ('startup', 'research', 'internship', 'job', 'project')",
            name="opportunity_type",
        ),
        CheckConstraint(
            "status IN ('draft', 'open', 'closed', 'archived')",
            name="opportunity_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="open", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner_profile: Mapped["UserProfile"] = relationship(
        back_populates="owned_opportunities"
    )
    applications: Mapped[list["OpportunityApplication"]] = relationship(
        back_populates="opportunity", cascade="all, delete-orphan"
    )
    saved_opportunities: Mapped[list["SavedOpportunity"]] = relationship(
        back_populates="opportunity", cascade="all, delete-orphan"
    )
