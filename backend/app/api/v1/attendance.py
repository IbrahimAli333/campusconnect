from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.attendance_record import AttendanceRecord
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.attendance import (
    LessonAttendanceResponse,
    LessonAttendanceUpdateRequest,
)
from app.schemas.portal import (
    PortalAttendanceSummary,
    PortalLesson,
    PortalLessonRosterStudent,
)


router = APIRouter(prefix="/attendance", tags=["attendance"])


def _get_teacher_profile(db: Session, user: User) -> TeacherProfile:
    profile = db.scalar(
        select(TeacherProfile)
        .options(joinedload(TeacherProfile.user))
        .where(TeacherProfile.user_id == user.id)
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found",
        )
    return profile


def _get_lesson(db: Session, lesson_id: int) -> Lesson:
    lesson = db.scalar(
        select(Lesson)
        .options(
            joinedload(Lesson.course),
            joinedload(Lesson.group),
            joinedload(Lesson.teacher_profile).joinedload(TeacherProfile.user),
        )
        .where(Lesson.id == lesson_id)
    )
    if lesson is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found",
        )
    return lesson


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


def _lesson_roster(db: Session, lesson: Lesson) -> list[StudentProfile]:
    return db.scalars(
        select(StudentProfile)
        .join(StudentProfile.user)
        .join(Enrollment, Enrollment.student_profile_id == StudentProfile.id)
        .options(joinedload(StudentProfile.user))
        .where(
            StudentProfile.student_group_id == lesson.group_id,
            Enrollment.course_id == lesson.course_id,
            Enrollment.status == "active",
        )
        .order_by(User.full_name, StudentProfile.id)
    ).all()


def _lesson_summary(
    lesson: Lesson,
    *,
    attendance_summary: PortalAttendanceSummary,
    roster: list[PortalLessonRosterStudent],
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
        roster=roster,
    )


def _lesson_attendance_response(
    db: Session,
    lesson: Lesson,
) -> LessonAttendanceResponse:
    students = _lesson_roster(db, lesson)
    records = db.scalars(
        select(AttendanceRecord).where(AttendanceRecord.lesson_id == lesson.id)
    ).all()
    status_by_student_id = {
        record.student_profile_id: record.status for record in records
    }
    summary = _attendance_summary_from_counts(
        Counter(record.status for record in records)
    )
    roster = [
        PortalLessonRosterStudent(
            student_profile_id=student.id,
            student_user_id=student.user_id,
            full_name=student.user.full_name,
            student_number=student.student_number,
            attendance_status=status_by_student_id.get(student.id),
        )
        for student in students
    ]
    lesson_summary = _lesson_summary(
        lesson,
        attendance_summary=summary,
        roster=roster,
    )
    return LessonAttendanceResponse(
        lesson=lesson_summary,
        attendance_summary=summary,
        records=roster,
    )


@router.put(
    "/lessons/{lesson_id}",
    response_model=LessonAttendanceResponse,
)
def update_lesson_attendance(
    lesson_id: int,
    request: LessonAttendanceUpdateRequest,
    current_user: User = Depends(require_roles(UserRole.teacher)),
    db: Session = Depends(get_db),
) -> LessonAttendanceResponse:
    teacher_profile = _get_teacher_profile(db, current_user)
    lesson = _get_lesson(db, lesson_id)

    course_teacher_id = lesson.course.teacher_profile_id
    if lesson.teacher_profile_id != teacher_profile.id or (
        course_teacher_id is not None and course_teacher_id != teacher_profile.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher is not assigned to this lesson",
        )

    roster = _lesson_roster(db, lesson)
    roster_by_profile_id = {student.id: student for student in roster}
    roster_by_user_id = {student.user_id: student for student in roster}
    submitted: list[tuple[StudentProfile, str]] = []
    seen_student_ids: set[int] = set()

    for item in request.records:
        student: StudentProfile | None = None
        if item.student_profile_id is not None:
            student = roster_by_profile_id.get(item.student_profile_id)
            if (
                student is not None
                and item.student_id is not None
                and student.user_id != item.student_id
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="student_id does not match student_profile_id",
                )
        elif item.student_id is not None:
            student = roster_by_user_id.get(item.student_id)

        if student is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student is not in the lesson roster",
            )

        if student.id in seen_student_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate attendance record for student",
            )

        seen_student_ids.add(student.id)
        submitted.append((student, item.status))

    existing_records = {
        record.student_profile_id: record
        for record in db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.lesson_id == lesson.id,
                AttendanceRecord.student_profile_id.in_(seen_student_ids),
            )
        ).all()
    }
    marked_at = datetime.now(timezone.utc)

    for student, attendance_status in submitted:
        record = existing_records.get(student.id)
        if record is None:
            record = AttendanceRecord(
                lesson_id=lesson.id,
                student_profile_id=student.id,
            )
            db.add(record)

        record.status = attendance_status
        record.marked_by_teacher_id = teacher_profile.id
        record.marked_at = marked_at

    db.commit()
    lesson = _get_lesson(db, lesson_id)
    return _lesson_attendance_response(db, lesson)
