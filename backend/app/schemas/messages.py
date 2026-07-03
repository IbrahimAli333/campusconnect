from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.base import ReadSchema
from app.schemas.network import ProfileSummary


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageRead(ReadSchema):
    id: int
    sender_profile_id: int
    recipient_profile_id: int
    body: str
    read_at: Optional[datetime]
    created_at: datetime


class MessageThreadRead(BaseModel):
    profile: ProfileSummary
    last_message: MessageRead
    unread_count: int


class UnreadMessagesRead(BaseModel):
    unread: int
