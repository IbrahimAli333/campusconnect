from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class University(Base):
    __tablename__ = "universities"
    __table_args__ = (UniqueConstraint("slug", name="uq_universities_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    faculties: Mapped[List["Faculty"]] = relationship(
        back_populates="university", cascade="all, delete-orphan"
    )
    departments: Mapped[List["Department"]] = relationship(
        back_populates="university", cascade="all, delete-orphan"
    )
    student_groups: Mapped[List["StudentGroup"]] = relationship(
        back_populates="university", cascade="all, delete-orphan"
    )
    announcements: Mapped[List["Announcement"]] = relationship(
        back_populates="university", cascade="all, delete-orphan"
    )
