from datetime import datetime

from app.schemas.base import ReadSchema


class StudentGroupRead(ReadSchema):
    id: int
    university_id: int
    department_id: int
    name: str
    start_year: int
    created_at: datetime
