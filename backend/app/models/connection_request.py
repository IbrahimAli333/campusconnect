from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


CONNECTION_REQUEST_STATUSES = ("pending", "accepted", "declined", "canceled")


class ConnectionRequest(Base):
    __tablename__ = "connection_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'canceled')",
            name="connection_request_status",
        ),
        CheckConstraint(
            "requester_profile_id <> receiver_profile_id",
            name="connection_request_not_self",
        ),
        UniqueConstraint(
            "requester_profile_id",
            "receiver_profile_id",
            name="uq_connection_requests_requester_receiver",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    receiver_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    requester_profile: Mapped["UserProfile"] = relationship(
        back_populates="sent_connection_requests",
        foreign_keys=[requester_profile_id],
    )
    receiver_profile: Mapped["UserProfile"] = relationship(
        back_populates="received_connection_requests",
        foreign_keys=[receiver_profile_id],
    )
