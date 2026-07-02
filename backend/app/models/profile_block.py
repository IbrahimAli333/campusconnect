from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ProfileBlock(Base):
    __tablename__ = "profile_blocks"
    __table_args__ = (
        CheckConstraint(
            "blocker_profile_id <> blocked_profile_id",
            name="profile_block_not_self",
        ),
        UniqueConstraint(
            "blocker_profile_id",
            "blocked_profile_id",
            name="uq_profile_blocks_blocker_blocked",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    blocker_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    blocked_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    blocker_profile: Mapped["UserProfile"] = relationship(
        back_populates="blocks_made",
        foreign_keys=[blocker_profile_id],
    )
    blocked_profile: Mapped["UserProfile"] = relationship(
        back_populates="blocks_received",
        foreign_keys=[blocked_profile_id],
    )
