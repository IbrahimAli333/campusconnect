from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint(
            "sender_profile_id <> recipient_profile_id",
            name="message_not_self",
        ),
        Index(
            "ix_messages_sender_recipient",
            "sender_profile_id",
            "recipient_profile_id",
        ),
        Index(
            "ix_messages_recipient_read",
            "recipient_profile_id",
            "read_at",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sender_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    recipient_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sender_profile: Mapped["UserProfile"] = relationship(
        back_populates="sent_messages",
        foreign_keys=[sender_profile_id],
    )
    recipient_profile: Mapped["UserProfile"] = relationship(
        back_populates="received_messages",
        foreign_keys=[recipient_profile_id],
    )
