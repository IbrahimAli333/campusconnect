from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.base import ReadSchema


PushPlatform = Literal["ios", "android"]
PushLanguage = Literal["az", "en", "ru"]


class PushTokenRegister(BaseModel):
    token: str = Field(min_length=1, max_length=255)
    platform: Optional[PushPlatform] = None
    language: Optional[PushLanguage] = None


class PushTokenUnregister(BaseModel):
    token: str = Field(min_length=1, max_length=255)


class PushTokenRead(ReadSchema):
    id: int
    token: str
    platform: Optional[PushPlatform]
    language: Optional[PushLanguage] = None
    created_at: datetime
