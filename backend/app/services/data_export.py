"""'Download my data': a JSON copy of everything stored about one user.

Other people's personal data is kept to what the user can already see in the
app (names on their connections and conversations). Applicant details on the
user's own posts are reduced to counts, and reports filed against the user are
left out so reporters stay anonymous.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.connection_request import ConnectionRequest
from app.models.content_report import ContentReport
from app.models.message import Message
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.profile_block import ProfileBlock
from app.models.push_token import PushToken
from app.models.saved_opportunity import SavedOpportunity
from app.models.user import User
from app.models.user_profile import UserProfile

EXPORT_FORMAT_VERSION = 1


def _iso(value: Optional[datetime | date]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def _name(profile: Optional[UserProfile]) -> Optional[str]:
    if profile is None or profile.user is None:
        return None
    return profile.user.full_name


def _mask_token(token: str) -> str:
    # Enough to recognise the device without handing out a usable push token.
    return f"{token[:18]}..." if len(token) > 18 else token


def build_user_data_export(db: Session, user: User) -> dict[str, Any]:
    export: dict[str, Any] = {
        "export_format_version": EXPORT_FORMAT_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "notes": [
            "Your password is stored only as a one-way hash and is not included.",
            "Reports other users filed about you are not included, to protect reporters.",
            "Applicants to your posts are shown as counts; their profiles belong to them.",
        ],
        "account": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "terms_version_accepted": user.terms_version,
            "terms_accepted_at": _iso(user.terms_accepted_at),
            "age_confirmed_at": _iso(user.age_confirmed_at),
            "created_at": _iso(user.created_at),
            "updated_at": _iso(user.updated_at),
        },
        "push_notification_devices": [
            {
                "platform": token.platform,
                "language": token.language,
                "token": _mask_token(token.token),
                "registered_at": _iso(token.created_at),
                "updated_at": _iso(token.updated_at),
            }
            for token in db.scalars(
                select(PushToken).where(PushToken.user_id == user.id)
            ).all()
        ],
    }

    if user.student_profile is not None:
        export["legacy_student_record"] = {
            "student_number": user.student_profile.student_number,
            "enrollment_year": user.student_profile.enrollment_year,
        }
    if user.teacher_profile is not None:
        export["legacy_teacher_record"] = {
            "teacher_number": user.teacher_profile.teacher_number,
            "title": user.teacher_profile.title,
        }

    profile = user.network_profile
    if profile is None:
        export["profile"] = None
        return export

    export["profile"] = {
        "id": profile.id,
        "role": profile.role,
        "headline": profile.headline,
        "bio": profile.bio,
        "university": profile.university,
        "faculty": profile.faculty,
        "graduation_year": profile.graduation_year,
        "location": profile.location,
        "visibility": profile.visibility,
        "created_at": _iso(profile.created_at),
        "updated_at": _iso(profile.updated_at),
    }
    export["skills"] = [
        {
            "name": user_skill.skill.name,
            "level": user_skill.level,
            "added_at": _iso(user_skill.created_at),
        }
        for user_skill in profile.skills
    ]
    export["portfolio_entries"] = [
        {
            "type": entry.entry_type,
            "title": entry.title,
            "organization": entry.organization,
            "description": entry.description,
            "start_date": _iso(entry.start_date),
            "end_date": _iso(entry.end_date),
            "is_current": entry.is_current,
            "url": entry.url,
            "created_at": _iso(entry.created_at),
            "updated_at": _iso(entry.updated_at),
        }
        for entry in profile.resume_entries
    ]
    export["opportunities_posted"] = [
        {
            "id": opportunity.id,
            "type": opportunity.type,
            "title": opportunity.title,
            "description": opportunity.description,
            "required_skills": opportunity.required_skills,
            "status": opportunity.status,
            "applications_received": len(opportunity.applications),
            "created_at": _iso(opportunity.created_at),
            "updated_at": _iso(opportunity.updated_at),
        }
        for opportunity in db.scalars(
            select(Opportunity).where(Opportunity.owner_profile_id == profile.id)
        ).all()
    ]
    export["applications_submitted"] = [
        {
            "opportunity_id": application.opportunity_id,
            "opportunity_title": application.opportunity.title,
            "status": application.status,
            "note": application.note,
            "submitted_at": _iso(application.created_at),
            "updated_at": _iso(application.updated_at),
        }
        for application in db.scalars(
            select(OpportunityApplication).where(
                OpportunityApplication.applicant_profile_id == profile.id
            )
        ).all()
    ]
    export["saved_opportunities"] = [
        {
            "opportunity_id": saved.opportunity_id,
            "opportunity_title": saved.opportunity.title,
            "saved_at": _iso(saved.created_at),
        }
        for saved in db.scalars(
            select(SavedOpportunity).where(SavedOpportunity.profile_id == profile.id)
        ).all()
    ]

    connections = db.scalars(
        select(ConnectionRequest).where(
            or_(
                ConnectionRequest.requester_profile_id == profile.id,
                ConnectionRequest.receiver_profile_id == profile.id,
            )
        )
    ).all()
    export["connections"] = [
        {
            "direction": "sent" if connection.requester_profile_id == profile.id else "received",
            "other_person": _name(
                connection.receiver_profile
                if connection.requester_profile_id == profile.id
                else connection.requester_profile
            ),
            "status": connection.status,
            "message": connection.message,
            "created_at": _iso(connection.created_at),
            "updated_at": _iso(connection.updated_at),
        }
        for connection in connections
    ]

    messages = db.scalars(
        select(Message)
        .where(
            or_(
                Message.sender_profile_id == profile.id,
                Message.recipient_profile_id == profile.id,
            )
        )
        .order_by(Message.created_at, Message.id)
    ).all()
    export["messages"] = [
        {
            "direction": "sent" if message.sender_profile_id == profile.id else "received",
            "other_person": _name(
                message.recipient_profile
                if message.sender_profile_id == profile.id
                else message.sender_profile
            ),
            "body": message.body,
            "sent_at": _iso(message.created_at),
            "read_at": _iso(message.read_at),
        }
        for message in messages
    ]
    export["blocked_people"] = [
        {
            "name": _name(block.blocked_profile),
            "blocked_at": _iso(block.created_at),
        }
        for block in db.scalars(
            select(ProfileBlock).where(ProfileBlock.blocker_profile_id == profile.id)
        ).all()
    ]
    export["reports_filed"] = [
        {
            "target_type": report.target_type,
            "target_profile_id": report.target_profile_id,
            "target_opportunity_id": report.target_opportunity_id,
            "reason": report.reason,
            "status": report.status,
            "created_at": _iso(report.created_at),
        }
        for report in db.scalars(
            select(ContentReport).where(ContentReport.reporter_profile_id == profile.id)
        ).all()
    ]
    return export
