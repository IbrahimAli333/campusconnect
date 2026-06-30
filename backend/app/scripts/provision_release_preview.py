from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.department import Department
from app.models.faculty import Faculty
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.resume_entry import ResumeEntry
from app.models.skill import Skill
from app.models.student_group import StudentGroup
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.university import University
from app.models.user import User, UserRole
from app.models.user_profile import UserProfile
from app.models.user_skill import UserSkill


ALLOW_ENV_VAR = "UNIVERSITY_PORTAL_ALLOW_RELEASE_TEST_PROVISIONING"
ALLOW_ENV_VALUE = "true"
CONFIRM_FLAG = "--confirm-render-preview"

RELEASE_TEST_CREDENTIALS = {
    "member": {
        "email": "member@example.edu",
        "password": "member-password",
        "full_name": "Nika Huseynli",
        "role": UserRole.member,
    },
    "student": {
        "email": "student@example.edu",
        "password": "student-password",
        "full_name": "Aydin Mammadli",
        "role": UserRole.student,
    },
    "teacher": {
        "email": "teacher@example.edu",
        "password": "teacher-password",
        "full_name": "Prof. Leyla Karimova",
        "role": UserRole.teacher,
    },
}

UNIVERSITY_NAME = "Baku State University"
FACULTY_NAME = "Faculty of Applied Mathematics and Cybernetics"
DEPARTMENT_NAME = "Computer Science"


ModelT = TypeVar("ModelT")


class ReleasePreviewProvisioningRefused(RuntimeError):
    pass


@dataclass(frozen=True)
class ProvisioningSummary:
    user_ids_by_role: dict[str, int]
    profile_ids_by_role: dict[str, int]
    opportunity_ids_by_title: dict[str, int]
    teacher_research_application_id: int


def ensure_release_preview_safeguards(
    *,
    confirm_render_preview: bool,
    environ: Mapping[str, str] | None = None,
) -> None:
    values = os.environ if environ is None else environ
    if not confirm_render_preview:
        raise ReleasePreviewProvisioningRefused(
            f"missing required confirmation flag {CONFIRM_FLAG}"
        )
    if values.get(ALLOW_ENV_VAR) != ALLOW_ENV_VALUE:
        raise ReleasePreviewProvisioningRefused(
            f"set {ALLOW_ENV_VAR}={ALLOW_ENV_VALUE} for this command only"
        )


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


def _seed_network_profile(
    db: Session,
    *,
    user: User,
    role: str,
    headline: str,
    bio: str,
    faculty: str,
    graduation_year: int | None = None,
) -> UserProfile:
    profile = _get_or_create(
        db,
        UserProfile,
        {"user_id": user.id},
        {
            "role": role,
            "headline": headline,
            "bio": bio,
            "university": UNIVERSITY_NAME,
            "faculty": faculty,
            "graduation_year": graduation_year,
            "location": "Baku, Azerbaijan",
            "visibility": "public",
        },
    )
    profile.role = role
    profile.headline = headline
    profile.bio = bio
    profile.university = UNIVERSITY_NAME
    profile.faculty = faculty
    profile.graduation_year = graduation_year
    profile.location = "Baku, Azerbaijan"
    profile.visibility = "public"
    db.flush()
    return profile


def _seed_skill(db: Session, name: str) -> Skill:
    skill = _get_or_create(db, Skill, {"name": name})
    skill.name = name
    db.flush()
    return skill


def _seed_user_skill(
    db: Session,
    *,
    profile: UserProfile,
    skill_name: str,
    level: str,
) -> UserSkill:
    skill = _seed_skill(db, skill_name)
    user_skill = _get_or_create(
        db,
        UserSkill,
        {"profile_id": profile.id, "skill_id": skill.id},
        {"level": level},
    )
    user_skill.level = level
    db.flush()
    return user_skill


def _seed_resume_entry(
    db: Session,
    *,
    profile: UserProfile,
    entry_type: str,
    title: str,
    organization: str,
    description: str,
    start_date: date,
    is_current: bool,
    url: str,
    end_date: date | None = None,
) -> ResumeEntry:
    entry = _get_or_create(
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
    entry.organization = organization
    entry.description = description
    entry.start_date = start_date
    entry.end_date = end_date
    entry.is_current = is_current
    entry.url = url
    db.flush()
    return entry


def _seed_opportunity(
    db: Session,
    *,
    owner_profile: UserProfile,
    opportunity_type: str,
    title: str,
    description: str,
    required_skills: list[str],
) -> Opportunity:
    opportunity = _get_or_create(
        db,
        Opportunity,
        {"owner_profile_id": owner_profile.id, "title": title},
        {
            "type": opportunity_type,
            "description": description,
            "required_skills": required_skills,
            "status": "open",
        },
    )
    opportunity.type = opportunity_type
    opportunity.description = description
    opportunity.required_skills = required_skills
    opportunity.status = "open"
    db.flush()
    return opportunity


def _seed_teacher_review_application(
    db: Session,
    *,
    opportunity: Opportunity,
    applicant_profile: UserProfile,
) -> OpportunityApplication:
    application = _get_or_create(
        db,
        OpportunityApplication,
        {
            "opportunity_id": opportunity.id,
            "applicant_profile_id": applicant_profile.id,
        },
        {
            "status": "submitted",
            "note": (
                "Interested in helping prepare datasets, document findings, "
                "and turn research notes into a portfolio-ready prototype."
            ),
        },
    )
    application.status = "submitted"
    application.note = (
        "Interested in helping prepare datasets, document findings, and turn "
        "research notes into a portfolio-ready prototype."
    )
    db.flush()
    return application


def provision_release_preview(
    db: Session,
    *,
    safeguards_confirmed: bool = False,
) -> ProvisioningSummary:
    if not safeguards_confirmed:
        raise ReleasePreviewProvisioningRefused(
            "release preview safeguards must be confirmed before provisioning"
        )

    university = _get_or_create(
        db,
        University,
        {"slug": "release-preview-university"},
        {"name": UNIVERSITY_NAME},
    )
    university.name = UNIVERSITY_NAME
    faculty = _get_or_create(
        db,
        Faculty,
        {"university_id": university.id, "code": "ENG"},
        {"name": FACULTY_NAME},
    )
    faculty.name = FACULTY_NAME
    department = _get_or_create(
        db,
        Department,
        {"university_id": university.id, "code": "CS"},
        {"faculty_id": faculty.id, "name": DEPARTMENT_NAME},
    )
    department.faculty_id = faculty.id
    department.name = DEPARTMENT_NAME
    student_group = _get_or_create(
        db,
        StudentGroup,
        {"department_id": department.id, "name": "CS-2030-A"},
        {"university_id": university.id, "start_year": 2026},
    )
    student_group.university_id = university.id
    student_group.start_year = 2026
    db.flush()

    member_user = _seed_user(db, **RELEASE_TEST_CREDENTIALS["member"])
    student_user = _seed_user(db, **RELEASE_TEST_CREDENTIALS["student"])
    teacher_user = _seed_user(db, **RELEASE_TEST_CREDENTIALS["teacher"])

    student_academic_profile = _get_or_create(
        db,
        StudentProfile,
        {"user_id": student_user.id},
        {
            "student_group_id": student_group.id,
            "student_number": "S-2030-CC01",
            "enrollment_year": 2026,
        },
    )
    student_academic_profile.student_group_id = student_group.id
    student_academic_profile.student_number = "S-2030-CC01"
    student_academic_profile.enrollment_year = 2026

    teacher_academic_profile = _get_or_create(
        db,
        TeacherProfile,
        {"user_id": teacher_user.id},
        {
            "department_id": department.id,
            "teacher_number": "T-CC-001",
            "title": "Professor",
        },
    )
    teacher_academic_profile.department_id = department.id
    teacher_academic_profile.teacher_number = "T-CC-001"
    teacher_academic_profile.title = "Professor"
    db.flush()

    member_profile = _seed_network_profile(
        db,
        user=member_user,
        role="member",
        headline="Community reviewer for student product and research teams",
        bio=(
            "Helps student teams validate campus product ideas, reviews project "
            "plans, and connects builders with alumni and community partners."
        ),
        faculty="Open Campus Community",
    )
    student_profile = _seed_network_profile(
        db,
        user=student_user,
        role="student",
        headline="CS student building campus collaboration tools",
        bio=(
            "Builds React Native prototypes, studies PostgreSQL-backed APIs, "
            "and looks for teammates on learning tools and student ventures."
        ),
        faculty=FACULTY_NAME,
        graduation_year=2030,
    )
    teacher_profile = _seed_network_profile(
        db,
        user=teacher_user,
        role="teacher",
        headline="Professor supervising applied AI and education technology research",
        bio=(
            "Mentors students on research methods, applied machine learning, "
            "and responsible education technology prototypes."
        ),
        faculty=FACULTY_NAME,
    )

    for profile, skill_name, level in (
        (member_profile, "Community Research", "intermediate"),
        (member_profile, "Product Feedback", "intermediate"),
        (member_profile, "Event Support", "beginner"),
        (student_profile, "Python", "advanced"),
        (student_profile, "React Native", "intermediate"),
        (student_profile, "PostgreSQL", "intermediate"),
        (student_profile, "Product Design", "intermediate"),
        (teacher_profile, "Machine Learning", "expert"),
        (teacher_profile, "Research Methods", "expert"),
        (teacher_profile, "Academic Supervision", "expert"),
        (teacher_profile, "Grant Writing", "advanced"),
    ):
        _seed_user_skill(
            db,
            profile=profile,
            skill_name=skill_name,
            level=level,
        )

    _seed_resume_entry(
        db,
        profile=member_profile,
        entry_type="project",
        title="Community Product Feedback Circle",
        organization="CampusConnect Community",
        description=(
            "Reviews student project briefs, joins discovery calls, and shares "
            "structured feedback for early campus ventures."
        ),
        start_date=date(2026, 10, 1),
        is_current=True,
        url="https://example.edu/preview/community-feedback-circle",
    )
    _seed_resume_entry(
        db,
        profile=student_profile,
        entry_type="education",
        title="BSc Computer Science",
        organization=UNIVERSITY_NAME,
        description=(
            "Portfolio track in mobile engineering, databases, applied AI, "
            "and collaborative campus product development."
        ),
        start_date=date(2026, 9, 1),
        is_current=True,
        url="https://example.edu/preview/profiles/aydin",
    )
    _seed_resume_entry(
        db,
        profile=student_profile,
        entry_type="project",
        title="Campus Study Planner",
        organization="Student Startup Lab",
        description=(
            "Built a mobile planning prototype for study groups, project "
            "milestones, mentor notes, and portfolio-ready project evidence."
        ),
        start_date=date(2026, 11, 1),
        is_current=True,
        url="https://example.edu/preview/projects/study-planner",
    )
    _seed_resume_entry(
        db,
        profile=teacher_profile,
        entry_type="research",
        title="Applied AI In Education Research Group",
        organization=f"{UNIVERSITY_NAME} AI Lab",
        description=(
            "Supervises student research on recommendation systems, learning "
            "analytics, and responsible AI in academic products."
        ),
        start_date=date(2024, 9, 1),
        is_current=True,
        url="https://example.edu/preview/labs/applied-ai",
    )

    student_startup = _seed_opportunity(
        db,
        owner_profile=student_profile,
        opportunity_type="startup",
        title="Campus Study Planner Cofounder",
        description=(
            "Looking for a technical or product cofounder to validate a student "
            "planning and portfolio app with Baku university teams."
        ),
        required_skills=["React Native", "Product Design", "Product Feedback"],
    )
    teacher_research = _seed_opportunity(
        db,
        owner_profile=teacher_profile,
        opportunity_type="research",
        title="Research Assistant for Learning Analytics Lab",
        description=(
            "Join a small research group preparing datasets, evaluation notes, "
            "and prototype dashboards for responsible learning analytics."
        ),
        required_skills=["Python", "Research Methods", "Machine Learning"],
    )
    application = _seed_teacher_review_application(
        db,
        opportunity=teacher_research,
        applicant_profile=student_profile,
    )

    db.commit()
    return ProvisioningSummary(
        user_ids_by_role={
            "member": member_user.id,
            "student": student_user.id,
            "teacher": teacher_user.id,
        },
        profile_ids_by_role={
            "member": member_profile.id,
            "student": student_profile.id,
            "teacher": teacher_profile.id,
        },
        opportunity_ids_by_title={
            student_startup.title: student_startup.id,
            teacher_research.title: teacher_research.id,
        },
        teacher_research_application_id=application.id,
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Provision the minimum CampusConnect Render preview smoke data."
    )
    parser.add_argument(
        CONFIRM_FLAG,
        action="store_true",
        help="confirm this is the approved Render preview service",
    )
    return parser


def _print_summary(summary: ProvisioningSummary) -> None:
    print("Release preview provisioning complete.")
    print("Accounts:")
    for role, user_id in summary.user_ids_by_role.items():
        email = RELEASE_TEST_CREDENTIALS[role]["email"]
        profile_id = summary.profile_ids_by_role[role]
        print(f"- {role}: user_id={user_id} profile_id={profile_id} email={email}")
    print("Opportunities:")
    for title, opportunity_id in summary.opportunity_ids_by_title.items():
        print(f"- opportunity_id={opportunity_id} title={title}")
    print(
        "Teacher applicant-review application: "
        f"application_id={summary.teacher_research_application_id}"
    )


def main(
    argv: Sequence[str] | None = None,
    *,
    environ: Mapping[str, str] | None = None,
) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        ensure_release_preview_safeguards(
            confirm_render_preview=args.confirm_render_preview,
            environ=environ,
        )
    except ReleasePreviewProvisioningRefused as exc:
        print(f"Release preview provisioning refused: {exc}", file=sys.stderr)
        return 2

    from app.db.session import SessionLocal

    with SessionLocal() as db:
        try:
            summary = provision_release_preview(db, safeguards_confirmed=True)
        except Exception:
            db.rollback()
            raise

    _print_summary(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
