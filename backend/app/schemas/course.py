from datetime import datetime
from typing import Optional

from app.schemas.base import ReadSchema


class CourseRead(ReadSchema):
    id: int
    department_id: int
    teacher_profile_id: Optional[int]
    code: str
    title: str
    credits: Optional[int]
    created_at: datetime
