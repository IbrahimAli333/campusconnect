from datetime import datetime
from typing import Optional

from app.schemas.base import ReadSchema


class TeacherProfileRead(ReadSchema):
    id: int
    user_id: int
    department_id: int
    teacher_number: str
    title: Optional[str]
    created_at: datetime
