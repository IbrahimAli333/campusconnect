from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.base import ReadSchema


PushPlatform = Literal["ios", "android"]


class PushTokenRegister(BaseModel):
    token: str = Field(min_length=1, max_length=255)
    platform: Optional[PushPlatform] = None


class PushTokenUnregister(BaseModel):
    token: str = Field(min_length=1, max_length=255)


class PushTokenRead(ReadSchema):
    id: int
    token: str
    platform: Optional[PushPlatform]
    created_at: datetime
