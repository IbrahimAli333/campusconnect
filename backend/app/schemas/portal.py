from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


AttendanceStatus = Literal["present", "absent", "late", "excused"]


class PortalUserSummary(BaseModel):
    id: int
    email: str
    full_name: str
    role: str


class PortalGroupSummary(BaseModel):
    id: int
    name: str
    start_year: int
    department_id: int
    department_name: str
    university_id: int
    university_name: str


class PortalDepartmentSummary(BaseModel):
    id: int
    name: str
    code: str
    university_id: int
    university_name: str


class PortalStudentProfile(BaseModel):
    id: int
    user: PortalUserSummary
    student_number: str
    enrollment_year: Optional[int]
    group: PortalGroupSummary


class PortalTeacherProfile(BaseModel):
    id: int
    user: PortalUserSummary
    teacher_number: str
    title: Optional[str]
    department: PortalDepartmentSummary


class PortalStudentCourse(BaseModel):
    id: int
    code: str
    title: str
    credits: Optional[int]
    enrollment_status: str
    teacher_name: Optional[str]


class PortalTeacherCourse(BaseModel):
    id: int
    code: str
    title: str
    credits: Optional[int]
    enrolled_count: int


class PortalAssignedClass(BaseModel):
    course_id: int
    course_code: str
    course_title: str
    group_id: int
    group_name: str
    enrolled_count: int


class PortalAttendanceSummary(BaseModel):
    total: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float


class PortalLessonRosterStudent(BaseModel):
    student_profile_id: int
    student_user_id: int
    full_name: str
    student_number: str
    attendance_status: Optional[AttendanceStatus]


class PortalTeacherGradeRosterStudent(BaseModel):
    student_profile_id: int
    student_user_id: int
    full_name: str
    student_number: str
    group_id: int
    group_name: str
    score: Optional[float] = None
    comment: Optional[str] = None
    graded_at: Optional[datetime] = None


class PortalLesson(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_title: str
    group_id: int
    group_name: str
    teacher_profile_id: int
    teacher_name: str
    starts_at: datetime
    ends_at: datetime
    room: Optional[str]
    lesson_type: str
    attendance_summary: Optional[PortalAttendanceSummary] = None
    roster: list[PortalLessonRosterStudent] = Field(default_factory=list)


class PortalAttendanceRecord(BaseModel):
    id: int
    lesson_id: int
    course_id: int
    course_code: str
    course_title: str
    group_id: int
    group_name: str
    teacher_name: str
    starts_at: datetime
    lesson_type: str
    room: Optional[str]
    status: AttendanceStatus
    marked_at: Optional[datetime]


class PortalGradeRecord(BaseModel):
    grade_item_id: int
    course_id: int
    course_code: str
    course_title: str
    title: str
    kind: str
    score: float
    max_score: float
    comment: Optional[str]
    graded_at: Optional[datetime]


class PortalCourseGradeSummary(BaseModel):
    course_id: int
    course_code: str
    course_title: str
    earned_score: float
    max_score: float
    percent: Optional[float]
    records: list[PortalGradeRecord]


class PortalMaterial(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_title: str
    title: str
    kind: str
    url: str
    published_by_teacher_id: Optional[int]
    created_at: datetime


class PortalAnnouncement(BaseModel):
    id: int
    title: str
    body: str
    target_role: str
    priority: str
    published_by_user_id: Optional[int]
    created_at: datetime


class PortalPendingGradeItem(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_title: str
    title: str
    kind: str
    max_score: float
    due_at: Optional[datetime]
    pending_count: int


class PortalTeacherGradeItem(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_title: str
    title: str
    kind: str
    max_score: float
    due_at: Optional[datetime]
    enrolled_count: int
    graded_count: int
    pending_count: int
    roster: list[PortalTeacherGradeRosterStudent] = Field(default_factory=list)


class StudentPortalResponse(BaseModel):
    profile: PortalStudentProfile
    courses: list[PortalStudentCourse]
    schedule: list[PortalLesson]
    attendance_summary: PortalAttendanceSummary
    attendance_records: list[PortalAttendanceRecord]
    grades_summary: list[PortalCourseGradeSummary]
    materials: list[PortalMaterial]
    announcements: list[PortalAnnouncement]


class TeacherPortalResponse(BaseModel):
    profile: PortalTeacherProfile
    assigned_courses: list[PortalTeacherCourse]
    assigned_classes: list[PortalAssignedClass]
    upcoming_lessons: list[PortalLesson]
    pending_grade_items: list[PortalPendingGradeItem]
    grade_items: list[PortalTeacherGradeItem]
    materials: list[PortalMaterial]
    announcements: list[PortalAnnouncement]
