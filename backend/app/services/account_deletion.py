"""Account cleanup shared by authenticated and verified operator deletion.

The caller owns authorization and the transaction. This service flushes the
cleanup so constraint failures are raised before the caller commits; it never
commits or rolls back the caller's transaction.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.announcement import Announcement
from app.models.material import Material
from app.models.teacher_profile import TeacherProfile
from app.models.user import User


def delete_user_account(db: Session, user: User) -> None:
    """Delete authored content, then the account and its existing ORM cascades.

    Announcements and legacy material listings normally keep their text/URL after
    their author reference is cleared. Remove those authored rows as part of account
    deletion instead. Shared courses and content belonging to other users remain.
    External resources referenced by material URLs are outside this transaction.
    """
    # Lock both author FK targets before taking content snapshots. PostgreSQL
    # then blocks new references until deletion commits (and rejects those
    # references afterward), rather than leaving concurrently inserted orphans.
    if db.scalar(select(User.id).where(User.id == user.id).with_for_update()) is None:
        return
    teacher = db.scalar(
        select(TeacherProfile).where(TeacherProfile.user_id == user.id).with_for_update()
    )
    # A caller may have loaded relationships before a token/content reassignment.
    # Reload those collections so ORM cascades follow current ownership.
    db.expire(user, [relation.key for relation in User.__mapper__.relationships])
    if teacher is not None:
        db.expire(teacher, [relation.key for relation in TeacherProfile.__mapper__.relationships])
    announcements = db.scalars(
        select(Announcement).where(Announcement.published_by_user_id == user.id)
        .with_for_update()
    ).all()
    materials = db.scalars(
        select(Material)
        .join(TeacherProfile, Material.published_by_teacher_id == TeacherProfile.id)
        .where(TeacherProfile.user_id == user.id)
        .with_for_update(of=Material)
    ).all()
    for announcement in announcements:
        db.delete(announcement)
    for material in materials:
        db.delete(material)

    db.delete(user)
    db.flush()
