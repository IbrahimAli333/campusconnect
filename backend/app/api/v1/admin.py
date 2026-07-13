from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.content_report import CONTENT_REPORT_STATUSES, ContentReport
from app.models.opportunity import Opportunity
from app.models.user import User, UserRole
from app.models.user_profile import UserProfile
from app.schemas.admin import (
    AdminOpportunityStatusUpdate,
    AdminReportRead,
    AdminReportStatusUpdate,
    AdminUserStatusUpdate,
)
from app.schemas.user import UserRead


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_roles(UserRole.admin))],
)


def _report_response(report: ContentReport) -> AdminReportRead:
    if report.target_type == "profile" and report.target_profile is not None:
        target_label = report.target_profile.user.full_name
    elif report.target_opportunity is not None:
        target_label = report.target_opportunity.title
    else:
        target_label = "(deleted)"

    return AdminReportRead(
        id=report.id,
        target_type=report.target_type,
        target_profile_id=report.target_profile_id,
        target_opportunity_id=report.target_opportunity_id,
        target_label=target_label,
        reporter_profile_id=report.reporter_profile_id,
        reporter_name=report.reporter_profile.user.full_name,
        reason=report.reason,
        status=report.status,
        created_at=report.created_at,
    )


def _report_load_options():
    return (
        joinedload(ContentReport.reporter_profile).joinedload(UserProfile.user),
        joinedload(ContentReport.target_profile).joinedload(UserProfile.user),
        joinedload(ContentReport.target_opportunity),
    )


@router.get("/reports", response_model=list[AdminReportRead])
def list_reports(
    report_status: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[AdminReportRead]:
    if report_status is not None and report_status not in CONTENT_REPORT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"status must be one of {', '.join(CONTENT_REPORT_STATUSES)}",
        )

    query = (
        select(ContentReport)
        .options(*_report_load_options())
        .order_by(ContentReport.created_at.desc(), ContentReport.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if report_status is not None:
        query = query.where(ContentReport.status == report_status)

    reports = db.scalars(query).unique().all()
    return [_report_response(report) for report in reports]


@router.patch("/reports/{report_id}", response_model=AdminReportRead)
def update_report_status(
    report_id: int,
    request: AdminReportStatusUpdate,
    db: Session = Depends(get_db),
) -> AdminReportRead:
    report = db.scalar(
        select(ContentReport)
        .options(*_report_load_options())
        .where(ContentReport.id == report_id)
    )
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    report.status = request.status
    db.commit()
    db.refresh(report)
    return _report_response(report)


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user_status(
    user_id: int,
    request: AdminUserStatusUpdate,
    current_user: User = Depends(require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
) -> User:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot change their own active status",
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Deactivation locks the account out immediately: logins get a generic 401
    # and existing access tokens fail the is_active check on their next request.
    user.is_active = request.is_active
    db.commit()
    db.refresh(user)
    return user


@router.patch("/opportunities/{opportunity_id}", response_model=dict)
def update_opportunity_status(
    opportunity_id: int,
    request: AdminOpportunityStatusUpdate,
    db: Session = Depends(get_db),
) -> dict:
    opportunity = db.get(Opportunity, opportunity_id)
    if opportunity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )

    opportunity.status = request.status
    db.commit()
    return {
        "id": opportunity.id,
        "title": opportunity.title,
        "status": opportunity.status,
    }
