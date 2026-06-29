from datetime import datetime
from typing import Optional

from app.schemas.base import ReadSchema


class StudentProfileRead(ReadSchema):
    id: int
    user_id: int
    student_group_id: int
    student_number: str
    enrollment_year: Optional[int]
    created_at: datetime
