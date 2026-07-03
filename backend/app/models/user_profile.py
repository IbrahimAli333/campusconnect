from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


NETWORK_PROFILE_ROLES = (
    "member",
    "student",
    "teacher",
    "mentor",
    "employer",
    "admin",
)
NETWORK_PROFILE_VISIBILITIES = ("public", "university_only", "private")


class UserProfile(Base):
    __tablename__ = "user_profiles"
    __table_args__ = (
        CheckConstraint(
            "role IN ('member', 'student', 'teacher', 'mentor', 'employer', 'admin')",
            name="network_profile_role",
        ),
        CheckConstraint(
            "visibility IN ('public', 'university_only', 'private')",
            name="network_profile_visibility",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    headline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    university: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    faculty: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    graduation_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    visibility: Mapped[str] = mapped_column(
        String(30), default="public", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="network_profile")
    skills: Mapped[list["UserSkill"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    resume_entries: Mapped[list["ResumeEntry"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    owned_opportunities: Mapped[list["Opportunity"]] = relationship(
        back_populates="owner_profile", cascade="all, delete-orphan"
    )
    applications: Mapped[list["OpportunityApplication"]] = relationship(
        back_populates="applicant_profile", cascade="all, delete-orphan"
    )
    sent_connection_requests: Mapped[list["ConnectionRequest"]] = relationship(
        back_populates="requester_profile",
        cascade="all, delete-orphan",
        foreign_keys="ConnectionRequest.requester_profile_id",
    )
    received_connection_requests: Mapped[list["ConnectionRequest"]] = relationship(
        back_populates="receiver_profile",
        cascade="all, delete-orphan",
        foreign_keys="ConnectionRequest.receiver_profile_id",
    )
    saved_opportunities: Mapped[list["SavedOpportunity"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    sent_messages: Mapped[list["Message"]] = relationship(
        back_populates="sender_profile",
        cascade="all, delete-orphan",
        foreign_keys="Message.sender_profile_id",
    )
    received_messages: Mapped[list["Message"]] = relationship(
        back_populates="recipient_profile",
        cascade="all, delete-orphan",
        foreign_keys="Message.recipient_profile_id",
    )
    blocks_made: Mapped[list["ProfileBlock"]] = relationship(
        back_populates="blocker_profile",
        cascade="all, delete-orphan",
        foreign_keys="ProfileBlock.blocker_profile_id",
    )
    blocks_received: Mapped[list["ProfileBlock"]] = relationship(
        back_populates="blocked_profile",
        cascade="all, delete-orphan",
        foreign_keys="ProfileBlock.blocked_profile_id",
    )
    filed_reports: Mapped[list["ContentReport"]] = relationship(
        back_populates="reporter_profile",
        cascade="all, delete-orphan",
        foreign_keys="ContentReport.reporter_profile_id",
    )
    reports_against: Mapped[list["ContentReport"]] = relationship(
        back_populates="target_profile",
        cascade="all, delete-orphan",
        foreign_keys="ContentReport.target_profile_id",
    )
