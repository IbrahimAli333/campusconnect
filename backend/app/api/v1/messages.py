from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_active_user
from app.api.v1.network import (
    _blocked_profile_ids,
    _get_or_create_profile,
    _get_profile,
    _profile_summary,
)
from app.db.session import get_db
from app.models.connection_request import ConnectionRequest
from app.models.message import Message
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.messages import (
    MessageCreate,
    MessageRead,
    MessageThreadRead,
    UnreadMessagesRead,
)
from app.services.push import queue_push_to_users


router = APIRouter(prefix="/network/messages", tags=["messages"])

MESSAGE_PREVIEW_LENGTH = 140


def _profiles_can_message(db: Session, profile_id: int, other_profile_id: int) -> bool:
    """Messaging is allowed only between two users with an accepted connection,
    or between applicant and poster on an accepted application."""
    accepted_connection = db.scalar(
        select(ConnectionRequest.id).where(
            ConnectionRequest.status == "accepted",
            or_(
                and_(
                    ConnectionRequest.requester_profile_id == profile_id,
                    ConnectionRequest.receiver_profile_id == other_profile_id,
                ),
                and_(
                    ConnectionRequest.requester_profile_id == other_profile_id,
                    ConnectionRequest.receiver_profile_id == profile_id,
                ),
            ),
        )
    )
    if accepted_connection is not None:
        return True

    accepted_application = db.scalar(
        select(OpportunityApplication.id)
        .join(Opportunity, OpportunityApplication.opportunity_id == Opportunity.id)
        .where(
            OpportunityApplication.status == "accepted",
            or_(
                and_(
                    OpportunityApplication.applicant_profile_id == profile_id,
                    Opportunity.owner_profile_id == other_profile_id,
                ),
                and_(
                    OpportunityApplication.applicant_profile_id == other_profile_id,
                    Opportunity.owner_profile_id == profile_id,
                ),
            ),
        )
    )
    return accepted_application is not None


def _get_messageable_profile(
    db: Session,
    viewer_profile: UserProfile,
    other_profile_id: int,
) -> UserProfile:
    other_profile = _get_profile(db, other_profile_id)
    if other_profile.id == viewer_profile.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot message yourself",
        )
    if other_profile.id in _blocked_profile_ids(db, viewer_profile.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    if not _profiles_can_message(db, viewer_profile.id, other_profile.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Messaging requires an accepted connection or an accepted "
                "application between you"
            ),
        )
    return other_profile


def _message_response(message: Message) -> MessageRead:
    return MessageRead.model_validate(message)


@router.get("/threads", response_model=list[MessageThreadRead])
def list_my_threads(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[MessageThreadRead]:
    profile = _get_or_create_profile(db, current_user)
    messages = db.scalars(
        select(Message)
        .where(
            or_(
                Message.sender_profile_id == profile.id,
                Message.recipient_profile_id == profile.id,
            )
        )
        .order_by(Message.created_at.desc(), Message.id.desc())
    ).all()

    blocked_ids = _blocked_profile_ids(db, profile.id)
    last_message_by_profile_id: dict[int, Message] = {}
    unread_by_profile_id: dict[int, int] = {}
    for message in messages:
        other_profile_id = (
            message.recipient_profile_id
            if message.sender_profile_id == profile.id
            else message.sender_profile_id
        )
        if other_profile_id in blocked_ids:
            continue
        last_message_by_profile_id.setdefault(other_profile_id, message)
        if message.recipient_profile_id == profile.id and message.read_at is None:
            unread_by_profile_id[other_profile_id] = (
                unread_by_profile_id.get(other_profile_id, 0) + 1
            )

    if not last_message_by_profile_id:
        return []

    other_profiles = db.scalars(
        select(UserProfile)
        .options(joinedload(UserProfile.user))
        .where(UserProfile.id.in_(last_message_by_profile_id))
    ).all()
    profiles_by_id = {other.id: other for other in other_profiles}

    return [
        MessageThreadRead(
            profile=_profile_summary(profiles_by_id[other_profile_id]),
            last_message=_message_response(last_message),
            unread_count=unread_by_profile_id.get(other_profile_id, 0),
        )
        for other_profile_id, last_message in last_message_by_profile_id.items()
        if other_profile_id in profiles_by_id
    ]


@router.get("/unread", response_model=UnreadMessagesRead)
def count_my_unread_messages(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> UnreadMessagesRead:
    profile = _get_or_create_profile(db, current_user)
    filters = [
        Message.recipient_profile_id == profile.id,
        Message.read_at.is_(None),
    ]
    blocked_ids = _blocked_profile_ids(db, profile.id)
    if blocked_ids:
        filters.append(Message.sender_profile_id.not_in(blocked_ids))

    unread = db.scalar(select(func.count(Message.id)).where(*filters)) or 0
    return UnreadMessagesRead(unread=unread)


@router.get("/threads/{profile_id}", response_model=list[MessageRead])
def list_thread_messages(
    profile_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[MessageRead]:
    profile = _get_or_create_profile(db, current_user)
    other_profile = _get_messageable_profile(db, profile, profile_id)

    messages = db.scalars(
        select(Message)
        .where(
            or_(
                and_(
                    Message.sender_profile_id == profile.id,
                    Message.recipient_profile_id == other_profile.id,
                ),
                and_(
                    Message.sender_profile_id == other_profile.id,
                    Message.recipient_profile_id == profile.id,
                ),
            )
        )
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    # Reading a thread marks the other side's messages as read.
    now = datetime.now(timezone.utc)
    marked_read = False
    for message in messages:
        if message.recipient_profile_id == profile.id and message.read_at is None:
            message.read_at = now
            marked_read = True
    if marked_read:
        db.commit()

    return [_message_response(message) for message in messages]


@router.post(
    "/threads/{profile_id}",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    profile_id: int,
    request: MessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MessageRead:
    profile = _get_or_create_profile(db, current_user)
    other_profile = _get_messageable_profile(db, profile, profile_id)

    message = Message(
        sender_profile_id=profile.id,
        recipient_profile_id=other_profile.id,
        body=request.body,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    preview = request.body
    if len(preview) > MESSAGE_PREVIEW_LENGTH:
        preview = f"{preview[: MESSAGE_PREVIEW_LENGTH - 1]}…"
    queue_push_to_users(
        db,
        background_tasks,
        [other_profile.user_id],
        title=f"Message from {current_user.full_name}",
        body=preview,
        data={"tab": "connections"},
    )
    return _message_response(message)
