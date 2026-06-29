from app.models.announcement import Announcement
from app.models.attendance_record import AttendanceRecord
from app.models.connection_request import ConnectionRequest
from app.models.course import Course
from app.models.department import Department
from app.models.enrollment import Enrollment
from app.models.faculty import Faculty
from app.models.grade_item import GradeItem
from app.models.grade_record import GradeRecord
from app.models.lesson import Lesson
from app.models.material import Material
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.resume_entry import ResumeEntry
from app.models.saved_opportunity import SavedOpportunity
from app.models.skill import Skill
from app.models.student_group import StudentGroup
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.university import University
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.user_skill import UserSkill

__all__ = [
    "Announcement",
    "AttendanceRecord",
    "ConnectionRequest",
    "Course",
    "Department",
    "Enrollment",
    "Faculty",
    "GradeItem",
    "GradeRecord",
    "Lesson",
    "Material",
    "Opportunity",
    "OpportunityApplication",
    "ResumeEntry",
    "SavedOpportunity",
    "Skill",
    "StudentGroup",
    "StudentProfile",
    "TeacherProfile",
    "University",
    "User",
    "UserProfile",
    "UserSkill",
]
