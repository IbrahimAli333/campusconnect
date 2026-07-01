from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.base import ReadSchema


NetworkRole = Literal["member", "student", "teacher", "mentor", "employer", "admin"]
ProfileVisibility = Literal["public", "university_only", "private"]
SkillLevel = Literal["beginner", "intermediate", "advanced", "expert"]
ResumeEntryType = Literal[
    "education", "work", "project", "research", "award", "certification"
]
OpportunityType = Literal["startup", "research", "internship", "job", "project"]
OpportunityStatus = Literal["draft", "open", "closed", "archived"]
ApplicationStatus = Literal[
    "submitted", "reviewing", "accepted", "rejected", "withdrawn"
]
OwnerApplicationStatusUpdate = Literal["reviewing", "accepted", "rejected"]
ConnectionRequestStatus = Literal["pending", "accepted", "declined", "canceled"]


class NetworkUserSummary(BaseModel):
    id: int
    email: str
    full_name: str
    role: str


class SkillBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)


class SkillRead(SkillBase, ReadSchema):
    id: int
    created_at: datetime


class UserSkillBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    level: SkillLevel


class UserSkillCreate(UserSkillBase):
    pass


class UserSkillUpdate(BaseModel):
    level: Optional[SkillLevel] = None


class UserSkillRead(ReadSchema):
    id: int
    skill: SkillRead
    level: SkillLevel
    created_at: datetime


class ResumeEntryBase(BaseModel):
    entry_type: ResumeEntryType
    title: str = Field(min_length=1, max_length=255)
    organization: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = False
    url: Optional[str] = Field(default=None, max_length=500)


class ResumeEntryCreate(ResumeEntryBase):
    pass


class ResumeEntryUpdate(BaseModel):
    entry_type: Optional[ResumeEntryType] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    organization: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    url: Optional[str] = Field(default=None, max_length=500)


class ResumeEntryRead(ResumeEntryBase, ReadSchema):
    id: int
    created_at: datetime
    updated_at: datetime


class ProfileBase(BaseModel):
    role: NetworkRole
    headline: Optional[str] = Field(default=None, max_length=255)
    bio: Optional[str] = None
    university: Optional[str] = Field(default=None, max_length=255)
    faculty: Optional[str] = Field(default=None, max_length=255)
    graduation_year: Optional[int] = None
    location: Optional[str] = Field(default=None, max_length=255)
    visibility: ProfileVisibility = "public"


class ProfileCreate(ProfileBase):
    pass


class ProfileUpdate(BaseModel):
    role: Optional[NetworkRole] = None
    headline: Optional[str] = Field(default=None, max_length=255)
    bio: Optional[str] = None
    university: Optional[str] = Field(default=None, max_length=255)
    faculty: Optional[str] = Field(default=None, max_length=255)
    graduation_year: Optional[int] = None
    location: Optional[str] = Field(default=None, max_length=255)
    visibility: Optional[ProfileVisibility] = None


class ProfileSummary(ReadSchema):
    id: int
    user: NetworkUserSummary
    role: NetworkRole
    headline: Optional[str]
    university: Optional[str]
    faculty: Optional[str]
    graduation_year: Optional[int]
    location: Optional[str]
    visibility: ProfileVisibility


class ProfileRead(ProfileSummary):
    bio: Optional[str]
    skills: list[UserSkillRead] = Field(default_factory=list)
    resume_entries: list[ResumeEntryRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class OpportunityBase(BaseModel):
    type: OpportunityType
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    required_skills: list[str] = Field(default_factory=list)
    status: OpportunityStatus = "open"


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    type: Optional[OpportunityType] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, min_length=1)
    required_skills: Optional[list[str]] = None
    status: Optional[OpportunityStatus] = None


class OpportunityRead(OpportunityBase, ReadSchema):
    id: int
    owner_profile: ProfileSummary
    created_at: datetime
    updated_at: datetime


class OpportunitySummary(ReadSchema):
    id: int
    owner_profile: ProfileSummary
    type: OpportunityType
    title: str
    status: OpportunityStatus
    created_at: datetime
    updated_at: datetime


class OpportunityDetailRead(OpportunityRead):
    has_applied: bool
    has_saved: bool


class OpportunityRecommendationRead(OpportunityDetailRead):
    match_score: int = Field(ge=0, le=100)
    match_reasons: list[str] = Field(default_factory=list)


class ProfileRecommendationRead(ProfileRead):
    connection_status: Optional[ConnectionRequestStatus] = None
    match_score: int = Field(ge=0, le=100)
    match_reasons: list[str] = Field(default_factory=list)


class OpportunityApplicationBase(BaseModel):
    note: Optional[str] = None


class OpportunityApplicationCreate(OpportunityApplicationBase):
    pass


class OpportunityApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    note: Optional[str] = None


class OpportunityApplicationStatusUpdate(BaseModel):
    status: OwnerApplicationStatusUpdate


class OpportunityApplicationRead(ReadSchema):
    id: int
    opportunity_id: int
    applicant_profile: ProfileSummary
    status: ApplicationStatus
    note: Optional[str]
    created_at: datetime
    updated_at: datetime


class MyOpportunityApplicationRead(ReadSchema):
    id: int
    opportunity: OpportunitySummary
    status: ApplicationStatus
    note: Optional[str]
    created_at: datetime
    updated_at: datetime


class OwnerOpportunityApplicationRead(ReadSchema):
    id: int
    opportunity: OpportunitySummary
    applicant_profile: ProfileSummary
    applicant_skills: list[UserSkillRead] = Field(default_factory=list)
    applicant_resume_entries: list[ResumeEntryRead] = Field(default_factory=list)
    status: ApplicationStatus
    note: Optional[str]
    created_at: datetime
    updated_at: datetime


class ConnectionRequestBase(BaseModel):
    message: Optional[str] = None


class ConnectionRequestCreate(ConnectionRequestBase):
    pass


class ConnectionRequestUpdate(BaseModel):
    status: Optional[ConnectionRequestStatus] = None
    message: Optional[str] = None


ConnectionRequestDecision = Literal["accepted", "declined", "canceled"]


class ConnectionRequestStatusUpdate(BaseModel):
    status: ConnectionRequestDecision


class ConnectionRequestRead(ReadSchema):
    id: int
    requester_profile: ProfileSummary
    receiver_profile: ProfileSummary
    status: ConnectionRequestStatus
    message: Optional[str]
    created_at: datetime
    updated_at: datetime


class MyConnectionsRead(BaseModel):
    sent: list[ConnectionRequestRead] = Field(default_factory=list)
    received: list[ConnectionRequestRead] = Field(default_factory=list)


class SavedOpportunityRead(ReadSchema):
    id: int
    profile_id: int
    opportunity_id: int
    created_at: datetime
