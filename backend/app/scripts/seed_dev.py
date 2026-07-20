from __future__ import annotations

import os
import re
from datetime import date, datetime, timezone
from typing import Any, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import hash_password
from app.models.announcement import Announcement
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.department import Department
from app.models.enrollment import Enrollment
from app.models.faculty import Faculty
from app.models.grade_item import GradeItem
from app.models.grade_record import GradeRecord
from app.models.lesson import Lesson
from app.models.material import Material
from app.models.opportunity import Opportunity
from app.models.resume_entry import ResumeEntry
from app.models.skill import Skill
from app.models.student_group import StudentGroup
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.university import University
from app.models.user import User, UserRole
from app.models.user_profile import UserProfile
from app.models.user_skill import UserSkill


DEV_CREDENTIALS = {
    "member": {
        "email": "member@example.edu",
        "password": "member-password",
    },
    "student": {
        "email": "student@example.edu",
        "password": "student-password",
    },
    "teacher": {
        "email": "teacher@example.edu",
        "password": "teacher-password",
    },
}

PREVIEW_CLUTTER_EXACT_TITLES = {"sad", "test", "testing", "qa"}
PREVIEW_CLUTTER_PATTERNS = (
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"\b\d{1,2}:\d{2}(?::\d{2})?\b"),
    re.compile(r"\b\d{10,}\b"),
    re.compile(r"\btimestamp\b", re.IGNORECASE),
    re.compile(r"\bqa\s*(?:test|post|opportunity)\b", re.IGNORECASE),
)

ModelT = TypeVar("ModelT")


def _environment_values(settings: Settings | None) -> set[str]:
    values = {
        os.getenv("ENVIRONMENT", ""),
        os.getenv("UNIVERSITY_PORTAL_ENVIRONMENT", ""),
    }
    if settings is not None:
        values.add(settings.environment)
    return {value.lower() for value in values if value}


def ensure_not_production(settings: Settings | None = None) -> None:
    if _environment_values(settings) & {"prod", "production"}:
        raise RuntimeError("Refusing to run dev seed in production")


def _get_or_create(
    db: Session,
    model: type[ModelT],
    lookup: dict[str, Any],
    defaults: dict[str, Any] | None = None,
) -> ModelT:
    instance = db.scalar(select(model).filter_by(**lookup))
    if instance is not None:
        return instance

    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance


def _is_preview_clutter_opportunity(opportunity: Opportunity) -> bool:
    title = re.sub(r"\s+", " ", opportunity.title.strip()).lower()
    if title in PREVIEW_CLUTTER_EXACT_TITLES:
        return True

    searchable_text = f"{opportunity.title}\n{opportunity.description}"
    return any(pattern.search(searchable_text) for pattern in PREVIEW_CLUTTER_PATTERNS)


def _remove_preview_clutter_opportunities(
    db: Session,
    profiles: tuple[UserProfile, ...],
) -> None:
    profile_ids = [profile.id for profile in profiles]
    if not profile_ids:
        return

    opportunities = db.scalars(
        select(Opportunity).where(Opportunity.owner_profile_id.in_(profile_ids))
    ).all()
    for opportunity in opportunities:
        if _is_preview_clutter_opportunity(opportunity):
            db.delete(opportunity)
    db.flush()


def _seed_user(
    db: Session,
    *,
    email: str,
    password: str,
    full_name: str,
    role: UserRole,
) -> User:
    user = _get_or_create(
        db,
        User,
        {"email": email},
        {
            "hashed_password": hash_password(password),
            "full_name": full_name,
            "role": role.value,
            "is_active": True,
        },
    )
    user.hashed_password = hash_password(password)
    user.full_name = full_name
    user.role = role.value
    user.is_active = True
    db.flush()
    return user


def seed_dev(
    db: Session,
    settings: Settings | None = None,
) -> dict[str, dict[str, str]]:
    settings = settings or get_settings()
    ensure_not_production(settings)

    university = _get_or_create(
        db,
        University,
        {"slug": "dev-university"},
        {"name": "Baku State University"},
    )
    university.name = "Baku State University"
    db.flush()

    faculty = _get_or_create(
        db,
        Faculty,
        {"university_id": university.id, "code": "ENG"},
        {"name": "Faculty of Applied Mathematics and Cybernetics"},
    )
    faculty.name = "Faculty of Applied Mathematics and Cybernetics"
    db.flush()

    department = _get_or_create(
        db,
        Department,
        {"university_id": university.id, "code": "CS"},
        {"faculty_id": faculty.id, "name": "Computer Science"},
    )
    department.faculty_id = faculty.id
    department.name = "Computer Science"
    db.flush()

    group = _get_or_create(
        db,
        StudentGroup,
        {"department_id": department.id, "name": "CS-2026-A"},
        {
            "university_id": university.id,
            "start_year": 2026,
        },
    )
    group.university_id = university.id
    group.start_year = 2026
    db.flush()

    teacher_user = _seed_user(
        db,
        email=DEV_CREDENTIALS["teacher"]["email"],
        password=DEV_CREDENTIALS["teacher"]["password"],
        full_name="Prof. Leyla Karimova",
        role=UserRole.teacher,
    )
    student_user = _seed_user(
        db,
        email=DEV_CREDENTIALS["student"]["email"],
        password=DEV_CREDENTIALS["student"]["password"],
        full_name="Aydin Mammadli",
        role=UserRole.student,
    )
    member_user = _seed_user(
        db,
        email=DEV_CREDENTIALS["member"]["email"],
        password=DEV_CREDENTIALS["member"]["password"],
        full_name="Nika Huseynli",
        role=UserRole.member,
    )
    professor_user = _seed_user(
        db,
        email="professor@example.edu",
        password="professor-password",
        full_name="Prof. Nigar Aliyeva",
        role=UserRole.teacher,
    )
    mentor_user = _seed_user(
        db,
        email="mentor@example.edu",
        password="mentor-password",
        full_name="Rauf Hasanov",
        role=UserRole.staff,
    )
    employer_user = _seed_user(
        db,
        email="employer@example.edu",
        password="employer-password",
        full_name="Caspian Tech Lab",
        role=UserRole.staff,
    )

    teacher_profile = _get_or_create(
        db,
        TeacherProfile,
        {"user_id": teacher_user.id},
        {
            "department_id": department.id,
            "teacher_number": "T-DEV-001",
            "title": "Professor",
        },
    )
    teacher_profile.department_id = department.id
    teacher_profile.teacher_number = "T-DEV-001"
    teacher_profile.title = "Professor"
    professor_profile = _get_or_create(
        db,
        TeacherProfile,
        {"user_id": professor_user.id},
        {
            "department_id": department.id,
            "teacher_number": "T-DEV-010",
            "title": "Associate Professor",
        },
    )
    professor_profile.department_id = department.id
    professor_profile.teacher_number = "T-DEV-010"
    professor_profile.title = "Associate Professor"
    db.flush()

    student_profile = _get_or_create(
        db,
        StudentProfile,
        {"user_id": student_user.id},
        {
            "student_group_id": group.id,
            "student_number": "S-DEV-001",
            "enrollment_year": 2026,
        },
    )
    student_profile.student_group_id = group.id
    student_profile.student_number = "S-DEV-001"
    student_profile.enrollment_year = 2026
    db.flush()

    programming = _get_or_create(
        db,
        Course,
        {"department_id": department.id, "code": "CS101"},
        {
            "teacher_profile_id": teacher_profile.id,
            "title": "Programming Fundamentals",
            "credits": 6,
        },
    )
    programming.teacher_profile_id = teacher_profile.id
    programming.title = "Programming Fundamentals"
    programming.credits = 6

    discrete_math = _get_or_create(
        db,
        Course,
        {"department_id": department.id, "code": "MATH101"},
        {
            "teacher_profile_id": teacher_profile.id,
            "title": "Discrete Mathematics",
            "credits": 5,
        },
    )
    discrete_math.teacher_profile_id = teacher_profile.id
    discrete_math.title = "Discrete Mathematics"
    discrete_math.credits = 5
    db.flush()

    for course in (programming, discrete_math):
        enrollment = _get_or_create(
            db,
            Enrollment,
            {"student_profile_id": student_profile.id, "course_id": course.id},
            {"status": "active"},
        )
        enrollment.status = "active"
    db.flush()

    programming_lesson = _get_or_create(
        db,
        Lesson,
        {
            "course_id": programming.id,
            "group_id": group.id,
            "lesson_type": "lecture",
            "room": "B-204",
        },
        {
            "teacher_profile_id": teacher_profile.id,
            "starts_at": datetime(2030, 9, 2, 9, 0, tzinfo=timezone.utc),
            "ends_at": datetime(2030, 9, 2, 10, 30, tzinfo=timezone.utc),
        },
    )
    programming_lesson.teacher_profile_id = teacher_profile.id
    programming_lesson.starts_at = datetime(2030, 9, 2, 9, 0, tzinfo=timezone.utc)
    programming_lesson.ends_at = datetime(2030, 9, 2, 10, 30, tzinfo=timezone.utc)

    math_lesson = _get_or_create(
        db,
        Lesson,
        {
            "course_id": discrete_math.id,
            "group_id": group.id,
            "lesson_type": "seminar",
            "room": "A-110",
        },
        {
            "teacher_profile_id": teacher_profile.id,
            "starts_at": datetime(2030, 9, 3, 11, 0, tzinfo=timezone.utc),
            "ends_at": datetime(2030, 9, 3, 12, 30, tzinfo=timezone.utc),
        },
    )
    math_lesson.teacher_profile_id = teacher_profile.id
    math_lesson.starts_at = datetime(2030, 9, 3, 11, 0, tzinfo=timezone.utc)
    math_lesson.ends_at = datetime(2030, 9, 3, 12, 30, tzinfo=timezone.utc)
    db.flush()

    programming_assignment = _get_or_create(
        db,
        GradeItem,
        {"course_id": programming.id, "title": "Assignment 1"},
        {
            "kind": "assignment",
            "max_score": 100,
            "due_at": datetime(2030, 9, 16, 23, 59, tzinfo=timezone.utc),
        },
    )
    programming_assignment.kind = "assignment"
    programming_assignment.max_score = 100
    programming_assignment.due_at = datetime(2030, 9, 16, 23, 59, tzinfo=timezone.utc)

    programming_midterm = _get_or_create(
        db,
        GradeItem,
        {"course_id": programming.id, "title": "Midterm Exam"},
        {
            "kind": "exam",
            "max_score": 100,
            "due_at": datetime(2030, 10, 20, 9, 0, tzinfo=timezone.utc),
        },
    )
    programming_midterm.kind = "exam"
    programming_midterm.max_score = 100
    programming_midterm.due_at = datetime(2030, 10, 20, 9, 0, tzinfo=timezone.utc)
    db.flush()

    assignment_grade = _get_or_create(
        db,
        GradeRecord,
        {
            "grade_item_id": programming_assignment.id,
            "student_profile_id": student_profile.id,
        },
        {
            "score": 88,
            "graded_by_teacher_id": teacher_profile.id,
            "graded_at": datetime(2030, 9, 18, 15, 0, tzinfo=timezone.utc),
        },
    )
    assignment_grade.score = 88
    assignment_grade.graded_by_teacher_id = teacher_profile.id
    assignment_grade.graded_at = datetime(2030, 9, 18, 15, 0, tzinfo=timezone.utc)

    programming_attendance = _get_or_create(
        db,
        AttendanceRecord,
        {
            "lesson_id": programming_lesson.id,
            "student_profile_id": student_profile.id,
        },
        {
            "status": "present",
            "marked_by_teacher_id": teacher_profile.id,
            "marked_at": datetime(2030, 9, 2, 9, 10, tzinfo=timezone.utc),
        },
    )
    programming_attendance.status = "present"
    programming_attendance.marked_by_teacher_id = teacher_profile.id
    programming_attendance.marked_at = datetime(2030, 9, 2, 9, 10, tzinfo=timezone.utc)

    math_attendance = _get_or_create(
        db,
        AttendanceRecord,
        {"lesson_id": math_lesson.id, "student_profile_id": student_profile.id},
        {
            "status": "late",
            "marked_by_teacher_id": teacher_profile.id,
            "marked_at": datetime(2030, 9, 3, 11, 12, tzinfo=timezone.utc),
        },
    )
    math_attendance.status = "late"
    math_attendance.marked_by_teacher_id = teacher_profile.id
    math_attendance.marked_at = datetime(2030, 9, 3, 11, 12, tzinfo=timezone.utc)
    db.flush()

    materials = (
        (
            programming,
            "CS101 Syllabus",
            "document",
            "https://example.edu/dev/materials/cs101-syllabus.pdf",
        ),
        (
            discrete_math,
            "Discrete Math Reading List",
            "link",
            "https://example.edu/dev/materials/math101-reading-list",
        ),
    )
    for course, title, kind, url in materials:
        material = _get_or_create(
            db,
            Material,
            {"course_id": course.id, "title": title},
            {
                "kind": kind,
                "url": url,
                "published_by_teacher_id": teacher_profile.id,
            },
        )
        material.kind = kind
        material.url = url
        material.published_by_teacher_id = teacher_profile.id

    announcements = (
        (
            "Legacy Academic Fixture",
            "This local seed keeps historical academic records for regression tests.",
            "all",
            "normal",
        ),
        (
            "Unibridge Profile Sprint",
            "Update your portfolio, skills, research interests, and project links.",
            "student",
            "high",
        ),
        (
            "Mentor And Research Call",
            "Post research, startup, internship, and project opportunities for students.",
            "teacher",
            "normal",
        ),
    )
    for title, body, target_role, priority in announcements:
        announcement = _get_or_create(
            db,
            Announcement,
            {"university_id": university.id, "title": title},
            {
                "body": body,
                "target_role": target_role,
                "priority": priority,
                "published_by_user_id": teacher_user.id,
            },
        )
        announcement.body = body
        announcement.target_role = target_role
        announcement.priority = priority
        announcement.published_by_user_id = teacher_user.id

    student_network_profile = _get_or_create(
        db,
        UserProfile,
        {"user_id": student_user.id},
        {
            "role": "student",
            "headline": "CS student building mobile tools for campus teams",
            "bio": (
                "Portfolio focused on React Native, Azerbaijani NLP, and student "
                "product prototypes. Looking for research mentors, startup "
                "cofounders, and project teammates."
            ),
            "university": university.name,
            "faculty": faculty.name,
            "graduation_year": 2030,
            "location": "Baku, Azerbaijan",
            "visibility": "public",
        },
    )
    student_network_profile.role = "student"
    student_network_profile.headline = (
        "CS student building mobile tools for campus teams"
    )
    student_network_profile.bio = (
        "Portfolio focused on React Native, Azerbaijani NLP, and student product "
        "prototypes. Looking for research mentors, startup cofounders, and "
        "project teammates."
    )
    student_network_profile.university = university.name
    student_network_profile.faculty = faculty.name
    student_network_profile.graduation_year = 2030
    student_network_profile.location = "Baku, Azerbaijan"
    student_network_profile.visibility = "public"

    member_network_profile = _get_or_create(
        db,
        UserProfile,
        {"user_id": member_user.id},
        {
            "role": "member",
            "headline": "Campus community member exploring collaborators and opportunities",
            "bio": (
                "Interested in browsing university projects, connecting with "
                "students and mentors, and applying to open opportunities."
            ),
            "university": university.name,
            "faculty": "Open Campus Community",
            "graduation_year": None,
            "location": "Baku, Azerbaijan",
            "visibility": "public",
        },
    )
    member_network_profile.role = "member"
    member_network_profile.headline = (
        "Campus community member exploring collaborators and opportunities"
    )
    member_network_profile.bio = (
        "Interested in browsing university projects, connecting with students "
        "and mentors, and applying to open opportunities."
    )
    member_network_profile.university = university.name
    member_network_profile.faculty = "Open Campus Community"
    member_network_profile.graduation_year = None
    member_network_profile.location = "Baku, Azerbaijan"
    member_network_profile.visibility = "public"

    mentor_network_profile = _get_or_create(
        db,
        UserProfile,
        {"user_id": teacher_user.id},
        {
            "role": "teacher",
            "headline": "Professor mentoring AI research and software teams",
            "bio": (
                "Supervises applied machine learning, education technology, and "
                "research commercialization projects. Open to mentoring student "
                "research assistants and startup teams."
            ),
            "university": university.name,
            "faculty": faculty.name,
            "graduation_year": None,
            "location": "Baku, Azerbaijan",
            "visibility": "public",
        },
    )
    mentor_network_profile.role = "teacher"
    mentor_network_profile.headline = (
        "Professor mentoring AI research and software teams"
    )
    mentor_network_profile.bio = (
        "Supervises applied machine learning, education technology, and research "
        "commercialization projects. Open to mentoring student research "
        "assistants and startup teams."
    )
    mentor_network_profile.university = university.name
    mentor_network_profile.faculty = faculty.name
    mentor_network_profile.graduation_year = None
    mentor_network_profile.location = "Baku, Azerbaijan"
    mentor_network_profile.visibility = "public"

    professor_network_profile = _get_or_create(
        db,
        UserProfile,
        {"user_id": professor_user.id},
        {
            "role": "teacher",
            "headline": "Professor supervising data science and smart city research",
            "bio": (
                "Works with student teams on urban analytics, open data, and "
                "grant-backed research prototypes for Baku-focused civic "
                "technology."
            ),
            "university": university.name,
            "faculty": faculty.name,
            "graduation_year": None,
            "location": "Baku, Azerbaijan",
            "visibility": "public",
        },
    )
    professor_network_profile.role = "teacher"
    professor_network_profile.headline = (
        "Professor supervising data science and smart city research"
    )
    professor_network_profile.bio = (
        "Works with student teams on urban analytics, open data, and grant-backed "
        "research prototypes for Baku-focused civic technology."
    )
    professor_network_profile.university = university.name
    professor_network_profile.faculty = faculty.name
    professor_network_profile.graduation_year = None
    professor_network_profile.location = "Baku, Azerbaijan"
    professor_network_profile.visibility = "public"

    startup_mentor_profile = _get_or_create(
        db,
        UserProfile,
        {"user_id": mentor_user.id},
        {
            "role": "mentor",
            "headline": "Startup mentor for student founders and product teams",
            "bio": (
                "Helps university teams validate ideas, form cofounder groups, "
                "prepare pitch decks, and connect with local accelerators."
            ),
            "university": university.name,
            "faculty": "Innovation and Entrepreneurship Center",
            "graduation_year": None,
            "location": "Baku, Azerbaijan",
            "visibility": "public",
        },
    )
    startup_mentor_profile.role = "mentor"
    startup_mentor_profile.headline = (
        "Startup mentor for student founders and product teams"
    )
    startup_mentor_profile.bio = (
        "Helps university teams validate ideas, form cofounder groups, prepare "
        "pitch decks, and connect with local accelerators."
    )
    startup_mentor_profile.university = university.name
    startup_mentor_profile.faculty = "Innovation and Entrepreneurship Center"
    startup_mentor_profile.graduation_year = None
    startup_mentor_profile.location = "Baku, Azerbaijan"
    startup_mentor_profile.visibility = "public"

    employer_network_profile = _get_or_create(
        db,
        UserProfile,
        {"user_id": employer_user.id},
        {
            "role": "employer",
            "headline": "Local technology lab hiring student interns",
            "bio": (
                "Posts internships and applied project briefs for students with "
                "backend, data, cloud, and product engineering portfolios."
            ),
            "university": university.name,
            "faculty": "Industry Partner",
            "graduation_year": None,
            "location": "Baku, Azerbaijan",
            "visibility": "public",
        },
    )
    employer_network_profile.role = "employer"
    employer_network_profile.headline = "Local technology lab hiring student interns"
    employer_network_profile.bio = (
        "Posts internships and applied project briefs for students with backend, "
        "data, cloud, and product engineering portfolios."
    )
    employer_network_profile.university = university.name
    employer_network_profile.faculty = "Industry Partner"
    employer_network_profile.graduation_year = None
    employer_network_profile.location = "Baku, Azerbaijan"
    employer_network_profile.visibility = "public"
    db.flush()

    profile_skills = (
        (student_network_profile, "Python", "advanced"),
        (student_network_profile, "React Native", "intermediate"),
        (student_network_profile, "PostgreSQL", "intermediate"),
        (student_network_profile, "Azerbaijani NLP", "intermediate"),
        (student_network_profile, "UX Research", "beginner"),
        (student_network_profile, "Product Design", "intermediate"),
        (member_network_profile, "Community Research", "intermediate"),
        (member_network_profile, "Product Feedback", "intermediate"),
        (member_network_profile, "Event Support", "beginner"),
        (mentor_network_profile, "Machine Learning", "expert"),
        (mentor_network_profile, "Research Methods", "expert"),
        (mentor_network_profile, "Academic Supervision", "expert"),
        (mentor_network_profile, "Grant Writing", "advanced"),
        (professor_network_profile, "Data Science", "expert"),
        (professor_network_profile, "Smart City Research", "advanced"),
        (professor_network_profile, "Open Data", "advanced"),
        (startup_mentor_profile, "Startup Validation", "expert"),
        (startup_mentor_profile, "Product Strategy", "advanced"),
        (startup_mentor_profile, "Fundraising", "advanced"),
        (startup_mentor_profile, "Pitch Coaching", "expert"),
        (employer_network_profile, "Backend Engineering", "advanced"),
        (employer_network_profile, "Cloud APIs", "advanced"),
        (employer_network_profile, "SQL", "advanced"),
    )
    skills_by_name: dict[str, Skill] = {}
    for _, skill_name, _ in profile_skills:
        skill = _get_or_create(db, Skill, {"name": skill_name})
        skill.name = skill_name
        skills_by_name[skill_name] = skill
    db.flush()

    for profile, skill_name, level in profile_skills:
        user_skill = _get_or_create(
            db,
            UserSkill,
            {"profile_id": profile.id, "skill_id": skills_by_name[skill_name].id},
            {"level": level},
        )
        user_skill.level = level

    resume_entries = (
        (
            student_network_profile,
            "education",
            "BSc Computer Science",
            university.name,
            (
                "Portfolio track in mobile engineering, databases, applied AI, "
                "and research methods."
            ),
            date(2026, 9, 1),
            None,
            True,
            "https://example.edu/dev/profiles/aydin",
        ),
        (
            student_network_profile,
            "project",
            "Campus Study Planner",
            "Student Startup Lab",
            (
                "Built a React Native prototype for study groups, project "
                "milestones, mentor notes, and portfolio-ready project evidence."
            ),
            date(2026, 11, 1),
            None,
            True,
            "https://example.edu/dev/projects/study-planner",
        ),
        (
            student_network_profile,
            "research",
            "Azerbaijani NLP Research Assistantship",
            f"{university.name} AI Lab",
            (
                "Annotated Azerbaijani academic abstracts and evaluated baseline "
                "models for mentor and research-topic discovery."
            ),
            date(2027, 1, 15),
            None,
            True,
            "https://example.edu/dev/research/azerbaijani-nlp",
        ),
        (
            student_network_profile,
            "work",
            "Backend Intern",
            "Baku FinTech Lab",
            (
                "Implemented FastAPI endpoints, SQL queries, and internal "
                "dashboard scripts for a summer internship portfolio."
            ),
            date(2027, 6, 1),
            date(2027, 8, 31),
            False,
            "https://example.edu/dev/work/backend-internship",
        ),
        (
            member_network_profile,
            "project",
            "Community Product Feedback Circle",
            "Unibridge Community",
            (
                "Reviews student project ideas, joins discovery calls, and "
                "connects active builders with useful campus contacts."
            ),
            date(2026, 10, 1),
            None,
            True,
            "https://example.edu/dev/members/nika",
        ),
        (
            mentor_network_profile,
            "research",
            "Applied AI In Education Research Group",
            f"{university.name} AI Lab",
            (
                "Supervises student research on recommendation systems, learning "
                "analytics, and responsible AI in academic products."
            ),
            date(2024, 9, 1),
            None,
            True,
            "https://example.edu/dev/labs/applied-ai",
        ),
        (
            mentor_network_profile,
            "award",
            "National Research Supervision Award",
            "Azerbaijan Education Innovation Forum",
            (
                "Recognized for mentoring student teams that turned research "
                "prototypes into deployable university tools."
            ),
            date(2026, 5, 20),
            None,
            False,
            "https://example.edu/dev/awards/research-supervision",
        ),
        (
            professor_network_profile,
            "research",
            "Baku Open Data For Smart Campuses",
            "Smart City Research Center",
            (
                "Leads grant-backed research on urban mobility, campus energy "
                "dashboards, and open datasets for student capstones."
            ),
            date(2025, 2, 1),
            None,
            True,
            "https://example.edu/dev/research/smart-campus",
        ),
        (
            startup_mentor_profile,
            "work",
            "Mentor In Residence",
            "Baku Startup House",
            (
                "Coaches student founders on customer interviews, MVP scoping, "
                "cofounder matching, and grant applications."
            ),
            date(2023, 9, 1),
            None,
            True,
            "https://example.edu/dev/mentors/rauf",
        ),
        (
            employer_network_profile,
            "work",
            "Student Internship Partner",
            "Caspian Tech Lab",
            (
                "Hosts student interns for backend, data, and cloud API projects "
                "with mentor feedback and portfolio reviews."
            ),
            date(2024, 1, 1),
            None,
            True,
            "https://example.edu/dev/partners/caspian-tech-lab",
        ),
    )
    for (
        profile,
        entry_type,
        title,
        organization,
        description,
        start_date,
        end_date,
        is_current,
        url,
    ) in resume_entries:
        resume_entry = _get_or_create(
            db,
            ResumeEntry,
            {
                "profile_id": profile.id,
                "entry_type": entry_type,
                "title": title,
            },
            {
                "organization": organization,
                "description": description,
                "start_date": start_date,
                "end_date": end_date,
                "is_current": is_current,
                "url": url,
            },
        )
        resume_entry.organization = organization
        resume_entry.description = description
        resume_entry.start_date = start_date
        resume_entry.end_date = end_date
        resume_entry.is_current = is_current
        resume_entry.url = url

    opportunities = (
        (
            student_network_profile,
            "startup",
            "Cofounder for Campus Study Planner",
            (
                "Looking for a technical or product cofounder to validate a "
                "student planning and portfolio app with Baku university teams."
            ),
            ["React Native", "Product Design", "Fundraising"],
            "open",
        ),
        (
            mentor_network_profile,
            "research",
            "Research Assistant for Azerbaijani NLP Lab",
            (
                "Join a small research group building datasets and baseline "
                "models for Azerbaijani academic text classification."
            ),
            ["Python", "Azerbaijani NLP", "Research Methods"],
            "open",
        ),
        (
            employer_network_profile,
            "internship",
            "Backend Internship at Caspian Tech Lab",
            (
                "Paid internship for students who want production FastAPI, SQL, "
                "and cloud API experience with a local technology lab."
            ),
            ["Python", "SQL", "Cloud APIs"],
            "open",
        ),
        (
            student_network_profile,
            "project",
            "Teammate for Caspian Robotics Capstone",
            (
                "Seeking a teammate to build a mobile dashboard and data pipeline "
                "for a student robotics project."
            ),
            ["React Native", "PostgreSQL", "Data Science"],
            "open",
        ),
        (
            startup_mentor_profile,
            "project",
            "Hackathon Team for Sustainable Campus Challenge",
            (
                "Forming interdisciplinary student teams for a weekend hackathon "
                "around energy dashboards, recycling, and campus mobility."
            ),
            ["UX Research", "Product Strategy", "Pitch Coaching"],
            "open",
        ),
        (
            professor_network_profile,
            "research",
            "Grant Proposal Team for Smart Campus Sensors",
            (
                "Looking for students to prepare a research grant proposal and "
                "prototype plan for low-cost campus environmental sensors."
            ),
            ["Smart City Research", "Open Data", "Grant Writing"],
            "open",
        ),
    )
    for owner_profile, opportunity_type, title, description, required_skills, status_ in (
        opportunities
    ):
        opportunity = _get_or_create(
            db,
            Opportunity,
            {"owner_profile_id": owner_profile.id, "title": title},
            {
                "type": opportunity_type,
                "description": description,
                "required_skills": required_skills,
                "status": status_,
            },
        )
        opportunity.type = opportunity_type
        opportunity.description = description
        opportunity.required_skills = required_skills
        opportunity.status = status_

    _remove_preview_clutter_opportunities(
        db,
        (
            student_network_profile,
            member_network_profile,
            mentor_network_profile,
            professor_network_profile,
            startup_mentor_profile,
            employer_network_profile,
        ),
    )

    db.commit()
    return DEV_CREDENTIALS


def print_credentials(credentials: dict[str, dict[str, str]]) -> None:
    print("Dev seed complete.")
    print("Test credentials:")
    for role, values in credentials.items():
        print(f"- {role}: {values['email']} / {values['password']}")


def main() -> None:
    settings = get_settings()
    ensure_not_production(settings)

    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        credentials = seed_dev(db, settings=settings)
    finally:
        db.close()

    print_credentials(credentials)


if __name__ == "__main__":
    main()
