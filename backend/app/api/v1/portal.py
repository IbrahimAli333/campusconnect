from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.api.v1.grades import teacher_grade_item_summaries
from app.db.session import get_db
from app.models.announcement import Announcement
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.department import Department
from app.models.enrollment import Enrollment
from app.models.grade_item import GradeItem
from app.models.grade_record import GradeRecord
from app.models.lesson import Lesson
from app.models.material import Material
from app.models.student_group import StudentGroup
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.portal import (
    PortalAnnouncement,
    PortalAssignedClass,
    PortalAttendanceRecord,
    PortalAttendanceSummary,
    PortalCourseGradeSummary,
    PortalDepartmentSummary,
    PortalGradeRecord,
    PortalGroupSummary,
    PortalLesson,
    PortalLessonRosterStudent,
    PortalMaterial,
    PortalPendingGradeItem,
    PortalStudentCourse,
    PortalStudentProfile,
    PortalTeacherCourse,
    PortalTeacherGradeItem,
    PortalTeacherProfile,
    PortalUserSummary,
    StudentPortalResponse,
    TeacherPortalResponse,
)


router = APIRouter(prefix="/portal", tags=["portal"])


def _user_summary(user: User) -> PortalUserSummary:
    return PortalUserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


def _student_profile_summary(profile: StudentProfile) -> PortalStudentProfile:
    group = profile.student_group
    department = group.department
    university = group.university
    return PortalStudentProfile(
        id=profile.id,
        user=_user_summary(profile.user),
        student_number=profile.student_number,
        enrollment_year=profile.enrollment_year,
        group=PortalGroupSummary(
            id=group.id,
            name=group.name,
            start_year=group.start_year,
            department_id=department.id,
            department_name=department.name,
            university_id=university.id,
            university_name=university.name,
        ),
    )


def _teacher_profile_summary(profile: TeacherProfile) -> PortalTeacherProfile:
    department = profile.department
    university = department.university
    return PortalTeacherProfile(
        id=profile.id,
        user=_user_summary(profile.user),
        teacher_number=profile.teacher_number,
        title=profile.title,
        department=PortalDepartmentSummary(
            id=department.id,
            name=department.name,
            code=department.code,
            university_id=university.id,
            university_name=university.name,
        ),
    )


def _attendance_summary_from_counts(counts: Counter[str]) -> PortalAttendanceSummary:
    total = sum(counts.values())
    return PortalAttendanceSummary(
        total=total,
        present=counts["present"],
        absent=counts["absent"],
        late=counts["late"],
        excused=counts["excused"],
        attendance_rate=round((counts["present"] / total) * 100, 2) if total else 0.0,
    )


def _lesson_summary(
    lesson: Lesson,
    *,
    attendance_summary: PortalAttendanceSummary | None = None,
    roster: list[PortalLessonRosterStudent] | None = None,
) -> PortalLesson:
    return PortalLesson(
        id=lesson.id,
        course_id=lesson.course_id,
        course_code=lesson.course.code,
        course_title=lesson.course.title,
        group_id=lesson.group_id,
        group_name=lesson.group.name,
        teacher_profile_id=lesson.teacher_profile_id,
        teacher_name=lesson.teacher_profile.user.full_name,
        starts_at=lesson.starts_at,
        ends_at=lesson.ends_at,
        room=lesson.room,
        lesson_type=lesson.lesson_type,
        attendance_summary=attendance_summary,
        roster=roster or [],
    )


def _attendance_record_summary(record: AttendanceRecord) -> PortalAttendanceRecord:
    lesson = record.lesson
    return PortalAttendanceRecord(
        id=record.id,
        lesson_id=lesson.id,
        course_id=lesson.course_id,
        course_code=lesson.course.code,
        course_title=lesson.course.title,
        group_id=lesson.group_id,
        group_name=lesson.group.name,
        teacher_name=lesson.teacher_profile.user.full_name,
        starts_at=lesson.starts_at,
        lesson_type=lesson.lesson_type,
        room=lesson.room,
        status=record.status,
        marked_at=record.marked_at,
    )


def _lesson_attendance_data(
    db: Session,
    lessons: list[Lesson],
) -> tuple[dict[int, PortalAttendanceSummary], dict[int, list[PortalLessonRosterStudent]]]:
    lesson_ids = [lesson.id for lesson in lessons]
    if not lesson_ids:
        return {}, {}

    attendance_records = db.scalars(
        select(AttendanceRecord).where(AttendanceRecord.lesson_id.in_(lesson_ids))
    ).all()
    records_by_lesson_id: dict[int, list[AttendanceRecord]] = defaultdict(list)
    status_by_lesson_student: dict[tuple[int, int], str] = {}
    for record in attendance_records:
        records_by_lesson_id[record.lesson_id].append(record)
        status_by_lesson_student[(record.lesson_id, record.student_profile_id)] = (
            record.status
        )

    summary_by_lesson_id = {
        lesson.id: _attendance_summary_from_counts(
            Counter(record.status for record in records_by_lesson_id[lesson.id])
        )
        for lesson in lessons
    }

    roster_by_lesson_id: dict[int, list[PortalLessonRosterStudent]] = defaultdict(list)
    roster_rows = db.execute(
        select(
            Lesson.id,
            StudentProfile.id,
            StudentProfile.user_id,
            User.full_name,
            StudentProfile.student_number,
        )
        .join(Enrollment, Enrollment.course_id == Lesson.course_id)
        .join(StudentProfile, StudentProfile.id == Enrollment.student_profile_id)
        .join(User, User.id == StudentProfile.user_id)
        .where(
            Lesson.id.in_(lesson_ids),
            Enrollment.status == "active",
            StudentProfile.student_group_id == Lesson.group_id,
        )
        .order_by(Lesson.starts_at, User.full_name, StudentProfile.id)
    ).all()

    for lesson_id, profile_id, user_id, full_name, student_number in roster_rows:
        roster_by_lesson_id[lesson_id].append(
            PortalLessonRosterStudent(
                student_profile_id=profile_id,
                student_user_id=user_id,
                full_name=full_name,
                student_number=student_number,
                attendance_status=status_by_lesson_student.get((lesson_id, profile_id)),
            )
        )

    return summary_by_lesson_id, roster_by_lesson_id


def _announcement_summary(announcement: Announcement) -> PortalAnnouncement:
    return PortalAnnouncement(
        id=announcement.id,
        title=announcement.title,
        body=announcement.body,
        target_role=announcement.target_role,
        priority=announcement.priority,
        published_by_user_id=announcement.published_by_user_id,
        created_at=announcement.created_at,
    )


def _material_summary(material: Material) -> PortalMaterial:
    return PortalMaterial(
        id=material.id,
        course_id=material.course_id,
        course_code=material.course.code,
        course_title=material.course.title,
        title=material.title,
        kind=material.kind,
        url=material.url,
        published_by_teacher_id=material.published_by_teacher_id,
        created_at=material.created_at,
    )


def _visible_announcements(
    db: Session,
    university_id: int,
    role: str,
) -> list[PortalAnnouncement]:
    announcements = db.scalars(
        select(Announcement)
        .where(
            Announcement.university_id == university_id,
            Announcement.target_role.in_(("all", role)),
        )
        .order_by(Announcement.created_at.desc(), Announcement.id.desc())
    ).all()
    return [_announcement_summary(announcement) for announcement in announcements]


def _is_upcoming(starts_at: datetime) -> bool:
    # Timestamps are written as tz-aware UTC; drivers without tz support
    # (e.g. SQLite) return them naive, so naive values are UTC, not local.
    now = datetime.now(starts_at.tzinfo if starts_at.tzinfo else timezone.utc)
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=timezone.utc)
    return starts_at >= now


def _get_student_profile(db: Session, user: User) -> StudentProfile:
    profile = db.scalar(
        select(StudentProfile)
        .options(
            joinedload(StudentProfile.user),
            joinedload(StudentProfile.student_group).joinedload(
                StudentGroup.department
            ),
            joinedload(StudentProfile.student_group).joinedload(StudentGroup.university),
        )
        .where(StudentProfile.user_id == user.id)
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found",
        )
    return profile


def _get_teacher_profile(db: Session, user: User) -> TeacherProfile:
    profile = db.scalar(
        select(TeacherProfile)
        .options(
            joinedload(TeacherProfile.user),
            joinedload(TeacherProfile.department).joinedload(Department.university),
        )
        .where(TeacherProfile.user_id == user.id)
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found",
        )
    return profile


@router.get("/student", response_model=StudentPortalResponse)
def read_student_portal(
    current_user: User = Depends(require_roles(UserRole.student)),
    db: Session = Depends(get_db),
) -> StudentPortalResponse:
    profile = _get_student_profile(db, current_user)

    enrollments = db.scalars(
        select(Enrollment)
        .options(
            joinedload(Enrollment.course)
            .joinedload(Course.teacher_profile)
            .joinedload(TeacherProfile.user)
        )
        .where(Enrollment.student_profile_id == profile.id)
        .order_by(Enrollment.id)
    ).all()
    course_ids = [enrollment.course_id for enrollment in enrollments]

    courses = [
        PortalStudentCourse(
            id=enrollment.course.id,
            code=enrollment.course.code,
            title=enrollment.course.title,
            credits=enrollment.course.credits,
            enrollment_status=enrollment.status,
            teacher_name=(
                enrollment.course.teacher_profile.user.full_name
                if enrollment.course.teacher_profile is not None
                else None
            ),
        )
        for enrollment in enrollments
    ]

    lessons: list[Lesson] = []
    materials: list[Material] = []
    grade_records: list[GradeRecord] = []
    attendance_records: list[AttendanceRecord] = []
    if course_ids:
        lessons = db.scalars(
            select(Lesson)
            .options(
                joinedload(Lesson.course),
                joinedload(Lesson.group),
                joinedload(Lesson.teacher_profile).joinedload(TeacherProfile.user),
            )
            .where(
                Lesson.group_id == profile.student_group_id,
                Lesson.course_id.in_(course_ids),
            )
            .order_by(Lesson.starts_at, Lesson.id)
        ).all()
        materials = db.scalars(
            select(Material)
            .options(joinedload(Material.course))
            .where(Material.course_id.in_(course_ids))
            .order_by(Material.created_at.desc(), Material.id.desc())
        ).all()
        grade_records = db.scalars(
            select(GradeRecord)
            .join(GradeRecord.grade_item)
            .options(
                joinedload(GradeRecord.grade_item).joinedload(GradeItem.course),
            )
            .where(
                GradeRecord.student_profile_id == profile.id,
                GradeItem.course_id.in_(course_ids),
            )
            .order_by(GradeRecord.graded_at.desc(), GradeRecord.id.desc())
        ).all()
        attendance_records = db.scalars(
            select(AttendanceRecord)
            .join(AttendanceRecord.lesson)
            .options(
                joinedload(AttendanceRecord.lesson).joinedload(Lesson.course),
                joinedload(AttendanceRecord.lesson).joinedload(Lesson.group),
                joinedload(AttendanceRecord.lesson)
                .joinedload(Lesson.teacher_profile)
                .joinedload(TeacherProfile.user),
            )
            .where(AttendanceRecord.student_profile_id == profile.id)
            .order_by(Lesson.starts_at.desc(), AttendanceRecord.id.desc())
            .limit(10)
        ).all()

    attendance_counts = Counter(
        dict(
            db.execute(
                select(AttendanceRecord.status, func.count(AttendanceRecord.id))
                .where(AttendanceRecord.student_profile_id == profile.id)
                .group_by(AttendanceRecord.status)
            ).all()
        )
    )
    attendance_summary = _attendance_summary_from_counts(attendance_counts)

    grade_records_by_course: dict[int, list[PortalGradeRecord]] = {}
    for record in grade_records:
        item = record.grade_item
        course = item.course
        grade_records_by_course.setdefault(course.id, []).append(
            PortalGradeRecord(
                grade_item_id=item.id,
                course_id=course.id,
                course_code=course.code,
                course_title=course.title,
                title=item.title,
                kind=item.kind,
                score=record.score,
                max_score=item.max_score,
                comment=record.comment,
                graded_at=record.graded_at,
            )
        )

    grade_summaries: list[PortalCourseGradeSummary] = []
    for enrollment in enrollments:
        course = enrollment.course
        records = grade_records_by_course.get(course.id, [])
        earned_score = round(sum(record.score for record in records), 2)
        max_score = round(sum(record.max_score for record in records), 2)
        grade_summaries.append(
            PortalCourseGradeSummary(
                course_id=course.id,
                course_code=course.code,
                course_title=course.title,
                earned_score=earned_score,
                max_score=max_score,
                percent=round((earned_score / max_score) * 100, 2)
                if max_score
                else None,
                records=records,
            )
        )

    return StudentPortalResponse(
        profile=_student_profile_summary(profile),
        courses=courses,
        schedule=[_lesson_summary(lesson) for lesson in lessons],
        attendance_summary=attendance_summary,
        attendance_records=[
            _attendance_record_summary(record) for record in attendance_records
        ],
        grades_summary=grade_summaries,
        materials=[_material_summary(material) for material in materials],
        announcements=_visible_announcements(
            db,
            profile.student_group.university_id,
            UserRole.student.value,
        ),
    )


@router.get("/teacher", response_model=TeacherPortalResponse)
def read_teacher_portal(
    current_user: User = Depends(require_roles(UserRole.teacher)),
    db: Session = Depends(get_db),
) -> TeacherPortalResponse:
    profile = _get_teacher_profile(db, current_user)

    courses = db.scalars(
        select(Course)
        .where(Course.teacher_profile_id == profile.id)
        .order_by(Course.code, Course.id)
    ).all()
    course_ids = [course.id for course in courses]

    enrolled_counts_by_course: dict[int, int] = {}
    lessons: list[Lesson] = []
    grade_items: list[GradeItem] = []
    teacher_grade_items: list[PortalTeacherGradeItem] = []
    materials: list[Material] = []
    class_counts: dict[tuple[int, int], int] = {}
    attendance_summary_by_lesson_id: dict[int, PortalAttendanceSummary] = {}
    roster_by_lesson_id: dict[int, list[PortalLessonRosterStudent]] = {}

    if course_ids:
        enrolled_counts_by_course = dict(
            db.execute(
                select(Enrollment.course_id, func.count(Enrollment.id))
                .where(
                    Enrollment.course_id.in_(course_ids),
                    Enrollment.status == "active",
                )
                .group_by(Enrollment.course_id)
            ).all()
        )

        lessons = db.scalars(
            select(Lesson)
            .options(
                joinedload(Lesson.course),
                joinedload(Lesson.group),
                joinedload(Lesson.teacher_profile).joinedload(TeacherProfile.user),
            )
            .where(Lesson.teacher_profile_id == profile.id)
            .order_by(Lesson.starts_at, Lesson.id)
        ).all()
        materials = db.scalars(
            select(Material)
            .options(joinedload(Material.course))
            .where(Material.course_id.in_(course_ids))
            .order_by(Material.created_at.desc(), Material.id.desc())
        ).all()
        group_ids = sorted({lesson.group_id for lesson in lessons})
        if group_ids:
            class_counts = {
                (course_id, group_id): count
                for course_id, group_id, count in db.execute(
                    select(
                        Enrollment.course_id,
                        StudentProfile.student_group_id,
                        func.count(Enrollment.id),
                    )
                    .join(
                        StudentProfile,
                        Enrollment.student_profile_id == StudentProfile.id,
                    )
                    .where(
                        Enrollment.course_id.in_(course_ids),
                        StudentProfile.student_group_id.in_(group_ids),
                        Enrollment.status == "active",
                    )
                    .group_by(Enrollment.course_id, StudentProfile.student_group_id)
                ).all()
            }

        grade_items = db.scalars(
            select(GradeItem)
            .options(joinedload(GradeItem.course))
            .where(GradeItem.course_id.in_(course_ids))
            .order_by(GradeItem.due_at, GradeItem.id)
        ).all()
        teacher_grade_items = teacher_grade_item_summaries(db, grade_items)

    attendance_summary_by_lesson_id, roster_by_lesson_id = _lesson_attendance_data(
        db,
        lessons,
    )

    unique_classes: dict[tuple[int, int], PortalAssignedClass] = {}
    for lesson in lessons:
        key = (lesson.course_id, lesson.group_id)
        unique_classes[key] = PortalAssignedClass(
            course_id=lesson.course_id,
            course_code=lesson.course.code,
            course_title=lesson.course.title,
            group_id=lesson.group_id,
            group_name=lesson.group.name,
            enrolled_count=class_counts.get(key, 0),
        )

    upcoming_lessons = [
        _lesson_summary(
            lesson,
            attendance_summary=attendance_summary_by_lesson_id.get(lesson.id),
            roster=roster_by_lesson_id.get(lesson.id, []),
        )
        for lesson in lessons
        if _is_upcoming(lesson.starts_at)
    ]

    pending_grade_items: list[PortalPendingGradeItem] = []
    for item in teacher_grade_items:
        if item.pending_count:
            pending_grade_items.append(
                PortalPendingGradeItem(
                    id=item.id,
                    course_id=item.course_id,
                    course_code=item.course_code,
                    course_title=item.course_title,
                    title=item.title,
                    kind=item.kind,
                    max_score=item.max_score,
                    due_at=item.due_at,
                    pending_count=item.pending_count,
                )
            )

    return TeacherPortalResponse(
        profile=_teacher_profile_summary(profile),
        assigned_courses=[
            PortalTeacherCourse(
                id=course.id,
                code=course.code,
                title=course.title,
                credits=course.credits,
                enrolled_count=enrolled_counts_by_course.get(course.id, 0),
            )
            for course in courses
        ],
        assigned_classes=sorted(
            unique_classes.values(),
            key=lambda item: (item.course_code, item.group_name),
        ),
        upcoming_lessons=upcoming_lessons,
        pending_grade_items=pending_grade_items,
        grade_items=teacher_grade_items,
        materials=[_material_summary(material) for material in materials],
        announcements=_visible_announcements(
            db,
            profile.department.university_id,
            UserRole.teacher.value,
        ),
    )
