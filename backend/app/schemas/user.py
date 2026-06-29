from datetime import datetime

from app.schemas.base import ReadSchema


class UserRead(ReadSchema):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
