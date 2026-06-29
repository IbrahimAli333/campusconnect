from app.schemas.course import CourseRead
from app.schemas.department import DepartmentRead
from app.schemas.faculty import FacultyRead
from app.schemas.grades import GradeRecordInput, GradeRecordsUpdateRequest
from app.schemas.portal import StudentPortalResponse, TeacherPortalResponse
from app.schemas.student_group import StudentGroupRead
from app.schemas.student_profile import StudentProfileRead
from app.schemas.teacher_profile import TeacherProfileRead
from app.schemas.university import UniversityRead
from app.schemas.user import UserRead
from app.schemas.auth import BootstrapAdminRequest, LoginRequest, TokenResponse

__all__ = [
    "BootstrapAdminRequest",
    "CourseRead",
    "DepartmentRead",
    "FacultyRead",
    "GradeRecordInput",
    "GradeRecordsUpdateRequest",
    "LoginRequest",
    "StudentGroupRead",
    "StudentPortalResponse",
    "StudentProfileRead",
    "TeacherProfileRead",
    "TeacherPortalResponse",
    "TokenResponse",
    "UniversityRead",
    "UserRead",
]
