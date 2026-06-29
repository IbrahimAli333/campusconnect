from typing import Optional

from pydantic import BaseModel, Field, model_validator


class GradeRecordInput(BaseModel):
    student_profile_id: Optional[int] = None
    student_id: Optional[int] = None
    score: float
    comment: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_student_identifier(self) -> "GradeRecordInput":
        if self.student_profile_id is None and self.student_id is None:
            raise ValueError("student_profile_id or student_id is required")
        return self


class GradeRecordsUpdateRequest(BaseModel):
    records: list[GradeRecordInput] = Field(min_length=1)
