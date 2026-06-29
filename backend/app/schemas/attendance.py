from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.portal import (
    AttendanceStatus,
    PortalAttendanceSummary,
    PortalLesson,
    PortalLessonRosterStudent,
)


class LessonAttendanceRecordInput(BaseModel):
    student_profile_id: Optional[int] = None
    student_id: Optional[int] = None
    status: AttendanceStatus

    @model_validator(mode="after")
    def require_student_identifier(self) -> "LessonAttendanceRecordInput":
        if self.student_profile_id is None and self.student_id is None:
            raise ValueError("student_profile_id or student_id is required")
        return self


class LessonAttendanceUpdateRequest(BaseModel):
    records: list[LessonAttendanceRecordInput] = Field(min_length=1)


class LessonAttendanceResponse(BaseModel):
    lesson: PortalLesson
    attendance_summary: PortalAttendanceSummary
    records: list[PortalLessonRosterStudent]
