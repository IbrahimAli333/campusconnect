from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


AdminReportStatus = Literal["open", "resolved", "dismissed"]


class AdminReportRead(BaseModel):
    id: int
    target_type: Literal["profile", "opportunity"]
    target_profile_id: Optional[int]
    target_opportunity_id: Optional[int]
    target_label: str
    reporter_profile_id: int
    reporter_name: str
    reason: Optional[str]
    status: AdminReportStatus
    created_at: datetime


class AdminReportStatusUpdate(BaseModel):
    status: AdminReportStatus


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminOpportunityStatusUpdate(BaseModel):
    status: Literal["open", "closed"]
