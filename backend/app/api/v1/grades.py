from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade_item import GradeItem
from app.models.grade_record import GradeRecord
from app.models.student_group import StudentGroup
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.grades import GradeRecordsUpdateRequest
from app.schemas.portal import PortalTeacherGradeItem, PortalTeacherGradeRosterStudent


router = APIRouter(prefix="/grades", tags=["grades"])


def get_teacher_profile(db: Session, user: User) -> TeacherProfile:
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


def get_grade_item(db: Session, grade_item_id: int) -> GradeItem:
    grade_item = db.scalar(
        select(GradeItem)
        .options(joinedload(GradeItem.course))
        .where(GradeItem.id == grade_item_id)
    )
    if grade_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grade item not found",
        )
    return grade_item


def ensure_teacher_owns_grade_item(
    grade_item: GradeItem,
    teacher_profile: TeacherProfile,
) -> None:
    if grade_item.course.teacher_profile_id != teacher_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher is not assigned to this grade item course",
        )


def active_course_rosters(
    db: Session,
    course_ids: list[int],
) -> dict[int, list[StudentProfile]]:
    """Active-enrollment rosters for several courses in one query."""
    rosters: dict[int, list[StudentProfile]] = {course_id: [] for course_id in course_ids}
    if not course_ids:
        return rosters

    rows = db.execute(
        select(Enrollment.course_id, StudentProfile)
        .join(StudentProfile, Enrollment.student_profile_id == StudentProfile.id)
        .join(User, User.id == StudentProfile.user_id)
        .options(
            joinedload(StudentProfile.user),
            joinedload(StudentProfile.student_group),
        )
        .where(
            Enrollment.course_id.in_(course_ids),
            Enrollment.status == "active",
        )
        .order_by(User.full_name, StudentProfile.id)
    ).all()
    for course_id, student in rows:
        rosters[course_id].append(student)
    return rosters


def active_course_roster(db: Session, course_id: int) -> list[StudentProfile]:
    return active_course_rosters(db, [course_id])[course_id]


def _grade_item_summary(
    grade_item: GradeItem,
    roster: list[StudentProfile],
    records_by_item_and_student: dict[tuple[int, int], GradeRecord],
) -> PortalTeacherGradeItem:
    roster_rows: list[PortalTeacherGradeRosterStudent] = []

    for student in roster:
        record = records_by_item_and_student.get((grade_item.id, student.id))
        group: StudentGroup = student.student_group
        roster_rows.append(
            PortalTeacherGradeRosterStudent(
                student_profile_id=student.id,
                student_user_id=student.user_id,
                full_name=student.user.full_name,
                student_number=student.student_number,
                group_id=group.id,
                group_name=group.name,
                score=record.score if record is not None else None,
                comment=record.comment if record is not None else None,
                graded_at=record.graded_at if record is not None else None,
            )
        )

    graded_count = sum(1 for row in roster_rows if row.score is not None)
    course: Course = grade_item.course
    return PortalTeacherGradeItem(
        id=grade_item.id,
        course_id=course.id,
        course_code=course.code,
        course_title=course.title,
        title=grade_item.title,
        kind=grade_item.kind,
        max_score=grade_item.max_score,
        due_at=grade_item.due_at,
        enrolled_count=len(roster_rows),
        graded_count=graded_count,
        pending_count=max(len(roster_rows) - graded_count, 0),
        roster=roster_rows,
    )


def teacher_grade_item_summaries(
    db: Session,
    grade_items: list[GradeItem],
) -> list[PortalTeacherGradeItem]:
    """Summaries for many grade items with a fixed number of queries.

    The teacher portal renders every grade item at once; loading rosters and
    records per item multiplies queries by the item count.
    """
    if not grade_items:
        return []

    rosters_by_course_id = active_course_rosters(
        db,
        sorted({item.course_id for item in grade_items}),
    )
    records_by_item_and_student = {
        (record.grade_item_id, record.student_profile_id): record
        for record in db.scalars(
            select(GradeRecord).where(
                GradeRecord.grade_item_id.in_([item.id for item in grade_items])
            )
        ).all()
    }
    return [
        _grade_item_summary(
            item,
            rosters_by_course_id[item.course_id],
            records_by_item_and_student,
        )
        for item in grade_items
    ]


def teacher_grade_item_summary(
    db: Session,
    grade_item: GradeItem,
) -> PortalTeacherGradeItem:
    return teacher_grade_item_summaries(db, [grade_item])[0]


@router.put(
    "/items/{grade_item_id}",
    response_model=PortalTeacherGradeItem,
)
def update_grade_item_records(
    grade_item_id: int,
    request: GradeRecordsUpdateRequest,
    current_user: User = Depends(require_roles(UserRole.teacher)),
    db: Session = Depends(get_db),
) -> PortalTeacherGradeItem:
    teacher_profile = get_teacher_profile(db, current_user)
    grade_item = get_grade_item(db, grade_item_id)
    ensure_teacher_owns_grade_item(grade_item, teacher_profile)

    roster = active_course_roster(db, grade_item.course_id)
    roster_by_profile_id = {student.id: student for student in roster}
    roster_by_user_id = {student.user_id: student for student in roster}
    submitted: list[tuple[StudentProfile, float, str | None]] = []
    seen_student_ids: set[int] = set()

    for item in request.records:
        if item.score < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Score cannot be below 0",
            )

        if item.score > grade_item.max_score:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Score cannot exceed grade item max_score",
            )

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
                detail="Student is not enrolled in this course",
            )

        if student.id in seen_student_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate grade record for student",
            )

        seen_student_ids.add(student.id)
        submitted.append((student, item.score, item.comment))

    existing_records = {
        record.student_profile_id: record
        for record in db.scalars(
            select(GradeRecord).where(
                GradeRecord.grade_item_id == grade_item.id,
                GradeRecord.student_profile_id.in_(seen_student_ids),
            )
        ).all()
    }
    graded_at = datetime.now(timezone.utc)

    for student, score, comment in submitted:
        record = existing_records.get(student.id)
        if record is None:
            record = GradeRecord(
                grade_item_id=grade_item.id,
                student_profile_id=student.id,
            )
            db.add(record)

        record.score = score
        record.comment = comment
        record.graded_by_teacher_id = teacher_profile.id
        record.graded_at = graded_at

    db.commit()
    grade_item = get_grade_item(db, grade_item_id)
    return teacher_grade_item_summary(db, grade_item)
