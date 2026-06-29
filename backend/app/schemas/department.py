from datetime import datetime

from app.schemas.base import ReadSchema


class DepartmentRead(ReadSchema):
    id: int
    university_id: int
    faculty_id: int
    name: str
    code: str
    created_at: datetime
