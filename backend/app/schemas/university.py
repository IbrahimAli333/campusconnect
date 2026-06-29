from datetime import datetime

from app.schemas.base import ReadSchema


class UniversityRead(ReadSchema):
    id: int
    name: str
    slug: str
    created_at: datetime
