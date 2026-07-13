from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_active_user
from app.core.action_rate_limit import (
    application_rate_limiter,
    connection_rate_limiter,
    enforce_action_limit,
    opportunity_rate_limiter,
    report_rate_limiter,
)
from app.db.session import get_db
from app.models.connection_request import ConnectionRequest
from app.models.content_report import ContentReport
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.profile_block import ProfileBlock
from app.models.resume_entry import ResumeEntry
from app.models.saved_opportunity import SavedOpportunity
from app.models.skill import Skill
from app.models.user import User
from app.models.user_profile import NETWORK_PROFILE_ROLES, UserProfile
from app.models.user_skill import UserSkill
from app.schemas.network import (
    ConnectionRequestCreate,
    ContentReportCreate,
    ContentReportRead,
    ConnectionRequestRead,
    ConnectionRequestStatusUpdate,
    MyConnectionsRead,
    MyOpportunityApplicationRead,
    NetworkUserSummary,
    OpportunityApplicationCreate,
    OpportunityApplicationRead,
    OpportunityApplicationStatusUpdate,
    OpportunityCreate,
    OpportunityDetailRead,
    OpportunityUpdate,
    OpportunityRecommendationRead,
    OwnerOpportunityApplicationRead,
    OpportunityRead,
    OpportunitySummary,
    ProfileRead,
    ProfileRecommendationRead,
    ProfileSummary,
    ProfileUpdate,
    ResumeEntryCreate,
    ResumeEntryRead,
    ResumeEntryUpdate,
    SavedOpportunityRead,
    SkillRead,
    UserSkillCreate,
    UserSkillRead,
    UserSkillUpdate,
)
from app.services.push import queue_push_to_users


router = APIRouter(prefix="/network", tags=["network"])

OWNER_REVIEWABLE_APPLICATION_STATUSES = {"submitted", "reviewing"}
RECOMMENDATION_LIMIT = 20
OPPORTUNITY_AUTHOR_TYPES_BY_ROLE = {
    "member": set(),
    "student": {"startup", "project"},
    "teacher": {"research"},
    "mentor": {"startup", "project", "research"},
    "employer": {"internship", "job", "project"},
    "admin": {"startup", "research", "internship", "job", "project"},
}
KEYWORD_RE = re.compile(r"[a-z0-9][a-z0-9+#._-]*", re.IGNORECASE)
SHORT_KEYWORD_ALLOWLIST = {"ai", "api", "ios", "ml", "nlp", "sql", "ui", "ux"}
KEYWORD_STOP_WORDS = {
    "and",
    "are",
    "for",
    "from",
    "into",
    "the",
    "to",
    "with",
    "you",
    "your",
}
OPPORTUNITY_ROLE_RELEVANCE = {
    "member": {
        "project": 18,
        "startup": 14,
        "research": 12,
        "internship": 10,
        "job": 8,
    },
    "student": {
        "internship": 25,
        "research": 22,
        "project": 20,
        "startup": 18,
        "job": 16,
    },
    "teacher": {
        "research": 22,
        "project": 16,
        "startup": 12,
        "internship": 8,
        "job": 8,
    },
    "mentor": {
        "startup": 22,
        "project": 18,
        "research": 16,
        "internship": 10,
        "job": 8,
    },
    "employer": {
        "job": 22,
        "internship": 20,
        "project": 12,
        "startup": 10,
        "research": 8,
    },
    "admin": {
        "research": 10,
        "project": 10,
        "internship": 10,
        "job": 10,
        "startup": 10,
    },
}
PROFILE_ROLE_RELEVANCE = {
    ("member", "student"): 14,
    ("member", "teacher"): 18,
    ("member", "mentor"): 20,
    ("member", "employer"): 12,
    ("student", "member"): 14,
    ("student", "teacher"): 25,
    ("student", "mentor"): 24,
    ("student", "employer"): 22,
    ("student", "student"): 12,
    ("teacher", "member"): 18,
    ("teacher", "student"): 25,
    ("teacher", "mentor"): 15,
    ("teacher", "employer"): 12,
    ("mentor", "member"): 20,
    ("mentor", "student"): 24,
    ("mentor", "teacher"): 15,
    ("mentor", "employer"): 12,
    ("employer", "member"): 12,
    ("employer", "student"): 22,
    ("employer", "mentor"): 14,
    ("employer", "teacher"): 12,
    ("admin", "member"): 8,
    ("admin", "student"): 8,
    ("admin", "teacher"): 8,
    ("admin", "mentor"): 8,
    ("admin", "employer"): 8,
}


def _commit_or_conflict(db: Session, detail: str) -> None:
    """Commit, mapping unique-constraint violations to the 409 the pre-checks
    return, so concurrent duplicate writes don't surface as 500s."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        ) from None


def _default_profile_role(user: User) -> str:
    if user.role in NETWORK_PROFILE_ROLES:
        return user.role
    return "mentor"


def _profile_load_options():
    return (
        joinedload(UserProfile.user),
        selectinload(UserProfile.skills).joinedload(UserSkill.skill),
        selectinload(UserProfile.resume_entries),
    )


def _get_profile(db: Session, profile_id: int) -> UserProfile:
    profile = db.scalar(
        select(UserProfile)
        .options(*_profile_load_options())
        .where(UserProfile.id == profile_id)
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    return profile


def _get_or_create_profile(db: Session, user: User) -> UserProfile:
    profile = db.scalar(
        select(UserProfile)
        .options(*_profile_load_options())
        .where(UserProfile.user_id == user.id)
    )
    if profile is not None:
        return profile

    profile = UserProfile(
        user_id=user.id,
        role=_default_profile_role(user),
        headline=None,
        visibility="public",
    )
    db.add(profile)
    db.commit()
    return _get_profile(db, profile.id)


def _allowed_opportunity_types(profile: UserProfile) -> set[str]:
    return OPPORTUNITY_AUTHOR_TYPES_BY_ROLE.get(profile.role, set())


def _opportunity_authoring_detail(profile: UserProfile) -> str:
    allowed_types = sorted(_allowed_opportunity_types(profile))
    if not allowed_types:
        return "This profile role cannot post opportunities"

    return (
        f"{profile.role.title()} profiles can post only these opportunity types: "
        f"{', '.join(allowed_types)}"
    )


def _can_view_profile(viewer_profile: UserProfile, profile: UserProfile) -> bool:
    if profile.id == viewer_profile.id:
        return True
    if profile.visibility == "public":
        return True
    if (
        profile.visibility == "university_only"
        and profile.university
        and profile.university == viewer_profile.university
    ):
        return True
    return False


def _blocked_profile_ids(db: Session, profile_id: int) -> set[int]:
    """Profiles hidden from this viewer: anyone they blocked or who blocked them."""
    pairs = db.execute(
        select(ProfileBlock.blocker_profile_id, ProfileBlock.blocked_profile_id).where(
            or_(
                ProfileBlock.blocker_profile_id == profile_id,
                ProfileBlock.blocked_profile_id == profile_id,
            )
        )
    ).all()
    return {
        blocked if blocker == profile_id else blocker for blocker, blocked in pairs
    }


def _normalized_text(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(value.strip().lower().split())


def _profile_skill_map(profile: UserProfile) -> dict[str, str]:
    return {
        _normalized_text(user_skill.skill.name): user_skill.skill.name
        for user_skill in profile.skills
        if _normalized_text(user_skill.skill.name)
    }


def _required_skill_map(opportunity: Opportunity) -> dict[str, str]:
    return {
        _normalized_text(skill_name): skill_name
        for skill_name in opportunity.required_skills or []
        if _normalized_text(skill_name)
    }


def _keyword_set(*values: str | None) -> set[str]:
    keywords: set[str] = set()
    for value in values:
        if not value:
            continue
        for raw_token in KEYWORD_RE.findall(value):
            token = raw_token.strip("._-").lower()
            if not token or token in KEYWORD_STOP_WORDS:
                continue
            if len(token) >= 3 or token in SHORT_KEYWORD_ALLOWLIST:
                keywords.add(token)
    return keywords


def _profile_keywords(profile: UserProfile) -> set[str]:
    values: list[str | None] = [
        profile.headline,
        profile.bio,
    ]
    for entry in profile.resume_entries:
        values.extend(
            [
                entry.entry_type,
                entry.title,
                entry.organization,
                entry.description,
            ]
        )
    return _keyword_set(*values)


def _opportunity_keywords(opportunity: Opportunity) -> set[str]:
    return _keyword_set(
        opportunity.type,
        opportunity.title,
        opportunity.description,
        *(opportunity.required_skills or []),
    )


def _field_matches(left: str | None, right: str | None) -> bool:
    return bool(_normalized_text(left) and _normalized_text(left) == _normalized_text(right))


def _short_list(values: set[str], limit: int = 3) -> str:
    return ", ".join(sorted(values)[:limit])


def _add_reason(reasons: list[str], reason: str) -> None:
    if reason not in reasons and len(reasons) < 5:
        reasons.append(reason)


def _score_opportunity_match(
    profile: UserProfile,
    opportunity: Opportunity,
) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    profile_skills = _profile_skill_map(profile)
    required_skills = _required_skill_map(opportunity)
    skill_matches = set(profile_skills) & set(required_skills)
    if required_skills:
        score += round(len(skill_matches) / len(required_skills) * 45)
    if skill_matches:
        matched_skills = {required_skills[name] for name in skill_matches}
        _add_reason(reasons, f"Matches skills: {_short_list(matched_skills)}")

    role_score = OPPORTUNITY_ROLE_RELEVANCE.get(profile.role, {}).get(
        opportunity.type,
        8,
    )
    score += role_score
    if role_score:
        _add_reason(
            reasons,
            f"{opportunity.type.title()} opportunity fits {profile.role} profile",
        )

    owner_profile = opportunity.owner_profile
    if _field_matches(profile.university, owner_profile.university):
        score += 10
        _add_reason(reasons, "Same university")
    if _field_matches(profile.faculty, owner_profile.faculty):
        score += 5
        _add_reason(reasons, "Same faculty")

    keyword_matches = _profile_keywords(profile) & _opportunity_keywords(opportunity)
    if keyword_matches:
        score += min(15, len(keyword_matches) * 3)
        _add_reason(reasons, f"Shared keywords: {_short_list(keyword_matches)}")

    return min(score, 100), reasons


def _score_profile_match(
    viewer_profile: UserProfile,
    candidate_profile: UserProfile,
) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    viewer_skills = _profile_skill_map(viewer_profile)
    candidate_skills = _profile_skill_map(candidate_profile)
    skill_matches = set(viewer_skills) & set(candidate_skills)
    if viewer_skills:
        score += round(len(skill_matches) / len(viewer_skills) * 35)
    if skill_matches:
        matched_skills = {candidate_skills[name] for name in skill_matches}
        _add_reason(reasons, f"Shared skills: {_short_list(matched_skills)}")

    if _field_matches(viewer_profile.university, candidate_profile.university):
        score += 12
        _add_reason(reasons, "Same university")
    if _field_matches(viewer_profile.faculty, candidate_profile.faculty):
        score += 8
        _add_reason(reasons, "Same faculty")

    role_pair = (viewer_profile.role, candidate_profile.role)
    role_score = PROFILE_ROLE_RELEVANCE.get(role_pair, 6)
    score += role_score
    if viewer_profile.role == candidate_profile.role:
        _add_reason(reasons, f"Shared {candidate_profile.role} role")
    else:
        _add_reason(
            reasons,
            f"Complementary {viewer_profile.role}-{candidate_profile.role} roles",
        )

    keyword_matches = _profile_keywords(viewer_profile) & _profile_keywords(
        candidate_profile
    )
    if keyword_matches:
        score += min(20, len(keyword_matches) * 4)
        _add_reason(reasons, f"Shared interests: {_short_list(keyword_matches)}")

    return min(score, 100), reasons


def _user_summary(user: User) -> NetworkUserSummary:
    return NetworkUserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


def _profile_summary(profile: UserProfile) -> ProfileSummary:
    return ProfileSummary(
        id=profile.id,
        user=_user_summary(profile.user),
        role=profile.role,
        headline=profile.headline,
        university=profile.university,
        faculty=profile.faculty,
        graduation_year=profile.graduation_year,
        location=profile.location,
        visibility=profile.visibility,
    )


def _profile_response(profile: UserProfile) -> ProfileRead:
    return ProfileRead(
        **_profile_summary(profile).model_dump(),
        bio=profile.bio,
        skills=[
            _user_skill_response(user_skill)
            for user_skill in sorted(profile.skills, key=lambda item: item.skill.name)
        ],
        resume_entries=[
            _resume_entry_response(entry)
            for entry in sorted(profile.resume_entries, key=lambda item: item.id)
        ],
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def _user_skill_response(user_skill: UserSkill) -> UserSkillRead:
    return UserSkillRead(
        id=user_skill.id,
        skill=SkillRead.model_validate(user_skill.skill),
        level=user_skill.level,
        created_at=user_skill.created_at,
    )


def _resume_entry_response(entry: ResumeEntry) -> ResumeEntryRead:
    return ResumeEntryRead.model_validate(entry)


def _get_my_user_skill(
    db: Session,
    profile: UserProfile,
    user_skill_id: int,
) -> UserSkill:
    user_skill = db.scalar(
        select(UserSkill)
        .options(joinedload(UserSkill.skill))
        .where(
            UserSkill.id == user_skill_id,
            UserSkill.profile_id == profile.id,
        )
    )
    if user_skill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found",
        )
    return user_skill


def _get_my_resume_entry(
    db: Session,
    profile: UserProfile,
    resume_entry_id: int,
) -> ResumeEntry:
    resume_entry = db.scalar(
        select(ResumeEntry).where(
            ResumeEntry.id == resume_entry_id,
            ResumeEntry.profile_id == profile.id,
        )
    )
    if resume_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume entry not found",
        )
    return resume_entry


def _get_or_create_skill_by_name(db: Session, name: str) -> Skill:
    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Skill name is required",
        )

    skill = db.scalar(
        select(Skill).where(func.lower(Skill.name) == normalized_name.lower())
    )
    if skill is not None:
        return skill

    skill = Skill(name=normalized_name)
    db.add(skill)
    db.flush()
    return skill


def _opportunity_load_options():
    return (
        joinedload(Opportunity.owner_profile).joinedload(UserProfile.user),
    )


def _get_opportunity(db: Session, opportunity_id: int) -> Opportunity:
    opportunity = db.scalar(
        select(Opportunity)
        .options(*_opportunity_load_options())
        .where(Opportunity.id == opportunity_id)
    )
    if opportunity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )
    return opportunity


def _opportunity_response(opportunity: Opportunity) -> OpportunityRead:
    return OpportunityRead(
        id=opportunity.id,
        owner_profile=_profile_summary(opportunity.owner_profile),
        type=opportunity.type,
        title=opportunity.title,
        description=opportunity.description,
        required_skills=list(opportunity.required_skills or []),
        status=opportunity.status,
        created_at=opportunity.created_at,
        updated_at=opportunity.updated_at,
    )


def _opportunity_summary(opportunity: Opportunity) -> OpportunitySummary:
    return OpportunitySummary(
        id=opportunity.id,
        owner_profile=_profile_summary(opportunity.owner_profile),
        type=opportunity.type,
        title=opportunity.title,
        status=opportunity.status,
        created_at=opportunity.created_at,
        updated_at=opportunity.updated_at,
    )


def _opportunity_detail_response(
    db: Session,
    opportunity: Opportunity,
    profile: UserProfile,
) -> OpportunityDetailRead:
    has_applied = (
        db.scalar(
            select(OpportunityApplication.id).where(
                OpportunityApplication.opportunity_id == opportunity.id,
                OpportunityApplication.applicant_profile_id == profile.id,
            )
        )
        is not None
    )
    has_saved = (
        db.scalar(
            select(SavedOpportunity.id).where(
                SavedOpportunity.opportunity_id == opportunity.id,
                SavedOpportunity.profile_id == profile.id,
            )
        )
        is not None
    )
    return OpportunityDetailRead(
        **_opportunity_response(opportunity).model_dump(),
        has_applied=has_applied,
        has_saved=has_saved,
    )


def _opportunity_recommendation_response(
    opportunity: Opportunity,
    has_applied: bool,
    has_saved: bool,
    match_score: int,
    match_reasons: list[str],
) -> OpportunityRecommendationRead:
    return OpportunityRecommendationRead(
        **_opportunity_response(opportunity).model_dump(),
        has_applied=has_applied,
        has_saved=has_saved,
        match_score=match_score,
        match_reasons=match_reasons,
    )


def _profile_recommendation_response(
    profile: UserProfile,
    connection_status: str | None,
    match_score: int,
    match_reasons: list[str],
) -> ProfileRecommendationRead:
    return ProfileRecommendationRead(
        **_profile_response(profile).model_dump(),
        connection_status=connection_status,
        match_score=match_score,
        match_reasons=match_reasons,
    )


def _application_response(
    application: OpportunityApplication,
) -> OpportunityApplicationRead:
    return OpportunityApplicationRead(
        id=application.id,
        opportunity_id=application.opportunity_id,
        applicant_profile=_profile_summary(application.applicant_profile),
        status=application.status,
        note=application.note,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def _resume_highlights(profile: UserProfile) -> list[ResumeEntryRead]:
    priority_types = {"project", "research", "work"}
    entries = sorted(
        profile.resume_entries,
        key=lambda entry: (
            0 if entry.entry_type in priority_types else 1,
            entry.id,
        ),
    )
    return [_resume_entry_response(entry) for entry in entries[:3]]


def _owner_application_response(
    application: OpportunityApplication,
) -> OwnerOpportunityApplicationRead:
    applicant_profile = application.applicant_profile
    return OwnerOpportunityApplicationRead(
        id=application.id,
        opportunity=_opportunity_summary(application.opportunity),
        applicant_profile=_profile_summary(applicant_profile),
        applicant_skills=[
            _user_skill_response(user_skill)
            for user_skill in sorted(
                applicant_profile.skills,
                key=lambda item: item.skill.name,
            )
        ],
        applicant_resume_entries=_resume_highlights(applicant_profile),
        status=application.status,
        note=application.note,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def _my_application_response(
    application: OpportunityApplication,
) -> MyOpportunityApplicationRead:
    return MyOpportunityApplicationRead(
        id=application.id,
        opportunity=_opportunity_summary(application.opportunity),
        status=application.status,
        note=application.note,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def _owner_application_load_options():
    return (
        joinedload(OpportunityApplication.opportunity)
        .joinedload(Opportunity.owner_profile)
        .joinedload(UserProfile.user),
        selectinload(OpportunityApplication.applicant_profile).joinedload(
            UserProfile.user
        ),
        selectinload(OpportunityApplication.applicant_profile)
        .selectinload(UserProfile.skills)
        .joinedload(UserSkill.skill),
        selectinload(OpportunityApplication.applicant_profile).selectinload(
            UserProfile.resume_entries
        ),
    )


def _get_owner_loaded_application(
    db: Session,
    application_id: int,
) -> OpportunityApplication:
    application = db.scalar(
        select(OpportunityApplication)
        .options(*_owner_application_load_options())
        .where(OpportunityApplication.id == application_id)
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return application


def _connection_response(connection: ConnectionRequest) -> ConnectionRequestRead:
    return ConnectionRequestRead(
        id=connection.id,
        requester_profile=_profile_summary(connection.requester_profile),
        receiver_profile=_profile_summary(connection.receiver_profile),
        status=connection.status,
        message=connection.message,
        created_at=connection.created_at,
        updated_at=connection.updated_at,
    )


def _connection_load_options():
    return (
        joinedload(ConnectionRequest.requester_profile).joinedload(UserProfile.user),
        joinedload(ConnectionRequest.receiver_profile).joinedload(UserProfile.user),
    )


@router.get("/me", response_model=ProfileRead)
def read_my_network_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ProfileRead:
    profile = _get_or_create_profile(db, current_user)
    return _profile_response(profile)


@router.patch("/me", response_model=ProfileRead)
def update_my_network_profile(
    request: ProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ProfileRead:
    profile = _get_or_create_profile(db, current_user)
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    return _profile_response(_get_profile(db, profile.id))


@router.get("/me/skills", response_model=list[UserSkillRead])
def list_my_skills(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[UserSkillRead]:
    profile = _get_or_create_profile(db, current_user)
    return [
        _user_skill_response(user_skill)
        for user_skill in sorted(profile.skills, key=lambda item: item.skill.name)
    ]


@router.post(
    "/me/skills",
    response_model=UserSkillRead,
    status_code=status.HTTP_201_CREATED,
)
def add_my_skill(
    request: UserSkillCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> UserSkillRead:
    profile = _get_or_create_profile(db, current_user)
    skill = _get_or_create_skill_by_name(db, request.name)

    existing_user_skill = db.scalar(
        select(UserSkill.id).where(
            UserSkill.profile_id == profile.id,
            UserSkill.skill_id == skill.id,
        )
    )
    if existing_user_skill is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile already has this skill",
        )

    user_skill = UserSkill(
        profile_id=profile.id,
        skill_id=skill.id,
        level=request.level,
    )
    db.add(user_skill)
    _commit_or_conflict(db, "Profile already has this skill")
    return _user_skill_response(_get_my_user_skill(db, profile, user_skill.id))


@router.patch("/me/skills/{user_skill_id}", response_model=UserSkillRead)
def update_my_skill(
    user_skill_id: int,
    request: UserSkillUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> UserSkillRead:
    profile = _get_or_create_profile(db, current_user)
    user_skill = _get_my_user_skill(db, profile, user_skill_id)
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(user_skill, field, value)

    db.commit()
    return _user_skill_response(_get_my_user_skill(db, profile, user_skill.id))


@router.delete("/me/skills/{user_skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_skill(
    user_skill_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    profile = _get_or_create_profile(db, current_user)
    user_skill = _get_my_user_skill(db, profile, user_skill_id)
    db.delete(user_skill)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/resume", response_model=list[ResumeEntryRead])
def list_my_resume_entries(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[ResumeEntryRead]:
    profile = _get_or_create_profile(db, current_user)
    return [
        _resume_entry_response(entry)
        for entry in sorted(profile.resume_entries, key=lambda item: item.id)
    ]


@router.post(
    "/me/resume",
    response_model=ResumeEntryRead,
    status_code=status.HTTP_201_CREATED,
)
def add_my_resume_entry(
    request: ResumeEntryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ResumeEntryRead:
    profile = _get_or_create_profile(db, current_user)
    resume_entry = ResumeEntry(profile_id=profile.id, **request.model_dump())
    db.add(resume_entry)
    db.commit()
    db.refresh(resume_entry)
    return _resume_entry_response(resume_entry)


@router.patch("/me/resume/{resume_entry_id}", response_model=ResumeEntryRead)
def update_my_resume_entry(
    resume_entry_id: int,
    request: ResumeEntryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ResumeEntryRead:
    profile = _get_or_create_profile(db, current_user)
    resume_entry = _get_my_resume_entry(db, profile, resume_entry_id)
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(resume_entry, field, value)

    db.commit()
    db.refresh(resume_entry)
    return _resume_entry_response(resume_entry)


@router.delete(
    "/me/resume/{resume_entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_my_resume_entry(
    resume_entry_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    profile = _get_or_create_profile(db, current_user)
    resume_entry = _get_my_resume_entry(db, profile, resume_entry_id)
    db.delete(resume_entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/profiles", response_model=list[ProfileRead])
def list_network_profiles(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[ProfileRead]:
    viewer_profile = _get_or_create_profile(db, current_user)
    visibility_filters = [
        UserProfile.id == viewer_profile.id,
        UserProfile.visibility == "public",
    ]
    if viewer_profile.university:
        visibility_filters.append(
            and_(
                UserProfile.visibility == "university_only",
                UserProfile.university == viewer_profile.university,
            )
        )

    filters = [or_(*visibility_filters)]
    blocked_ids = _blocked_profile_ids(db, viewer_profile.id)
    if blocked_ids:
        filters.append(UserProfile.id.not_in(blocked_ids))

    profiles = db.scalars(
        select(UserProfile)
        .join(UserProfile.user)
        .options(*_profile_load_options())
        .where(*filters)
        .order_by(User.full_name, UserProfile.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return [_profile_response(profile) for profile in profiles]


@router.get("/recommendations/profiles", response_model=list[ProfileRecommendationRead])
def recommend_profiles(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[ProfileRecommendationRead]:
    viewer_profile = _get_or_create_profile(db, current_user)
    visibility_filters = [
        UserProfile.visibility == "public",
    ]
    if viewer_profile.university:
        visibility_filters.append(
            and_(
                UserProfile.visibility == "university_only",
                UserProfile.university == viewer_profile.university,
            )
        )

    recommendation_filters = [
        UserProfile.id != viewer_profile.id,
        or_(*visibility_filters),
    ]
    blocked_ids = _blocked_profile_ids(db, viewer_profile.id)
    if blocked_ids:
        recommendation_filters.append(UserProfile.id.not_in(blocked_ids))

    profiles = db.scalars(
        select(UserProfile)
        .join(UserProfile.user)
        .options(*_profile_load_options())
        .where(*recommendation_filters)
    ).all()
    connections = db.scalars(
        select(ConnectionRequest)
        .where(
            or_(
                ConnectionRequest.requester_profile_id == viewer_profile.id,
                ConnectionRequest.receiver_profile_id == viewer_profile.id,
            )
        )
        .order_by(ConnectionRequest.updated_at.desc(), ConnectionRequest.id.desc())
    ).all()
    connection_status_by_profile_id: dict[int, str] = {}
    for connection in connections:
        other_profile_id = (
            connection.receiver_profile_id
            if connection.requester_profile_id == viewer_profile.id
            else connection.requester_profile_id
        )
        connection_status_by_profile_id.setdefault(other_profile_id, connection.status)

    scored_profiles: list[tuple[int, str, int, ProfileRecommendationRead]] = []
    for profile in profiles:
        match_score, match_reasons = _score_profile_match(viewer_profile, profile)
        scored_profiles.append(
            (
                match_score,
                profile.user.full_name.lower(),
                profile.id,
                _profile_recommendation_response(
                    profile=profile,
                    connection_status=connection_status_by_profile_id.get(
                        profile.id
                    ),
                    match_score=match_score,
                    match_reasons=match_reasons,
                ),
            )
        )

    scored_profiles.sort(key=lambda item: (-item[0], item[1], item[2]))
    return [item[3] for item in scored_profiles[:RECOMMENDATION_LIMIT]]


@router.get("/profiles/{profile_id}", response_model=ProfileRead)
def read_network_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ProfileRead:
    viewer_profile = _get_or_create_profile(db, current_user)
    profile = _get_profile(db, profile_id)
    if not _can_view_profile(viewer_profile, profile) or profile.id in _blocked_profile_ids(
        db, viewer_profile.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    return _profile_response(profile)


@router.get("/applications/me", response_model=list[MyOpportunityApplicationRead])
def list_my_applications(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[MyOpportunityApplicationRead]:
    profile = _get_or_create_profile(db, current_user)
    applications = db.scalars(
        select(OpportunityApplication)
        .options(
            joinedload(OpportunityApplication.opportunity)
            .joinedload(Opportunity.owner_profile)
            .joinedload(UserProfile.user)
        )
        .where(OpportunityApplication.applicant_profile_id == profile.id)
        .order_by(
            OpportunityApplication.created_at.desc(),
            OpportunityApplication.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    ).all()
    return [_my_application_response(application) for application in applications]


@router.get(
    "/recommendations/opportunities",
    response_model=list[OpportunityRecommendationRead],
)
def recommend_opportunities(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[OpportunityRecommendationRead]:
    profile = _get_or_create_profile(db, current_user)
    recommendation_filters = [
        Opportunity.status == "open",
        Opportunity.owner_profile_id != profile.id,
    ]
    blocked_ids = _blocked_profile_ids(db, profile.id)
    if blocked_ids:
        recommendation_filters.append(Opportunity.owner_profile_id.not_in(blocked_ids))

    opportunities = db.scalars(
        select(Opportunity)
        .options(*_opportunity_load_options())
        .where(*recommendation_filters)
    ).all()
    opportunity_ids = [opportunity.id for opportunity in opportunities]
    if not opportunity_ids:
        return []

    applied_opportunity_ids = set(
        db.scalars(
            select(OpportunityApplication.opportunity_id).where(
                OpportunityApplication.applicant_profile_id == profile.id,
                OpportunityApplication.opportunity_id.in_(opportunity_ids),
            )
        )
    )
    saved_opportunity_ids = set(
        db.scalars(
            select(SavedOpportunity.opportunity_id).where(
                SavedOpportunity.profile_id == profile.id,
                SavedOpportunity.opportunity_id.in_(opportunity_ids),
            )
        )
    )

    scored_opportunities: list[
        tuple[int, datetime, int, OpportunityRecommendationRead]
    ] = []
    for opportunity in opportunities:
        match_score, match_reasons = _score_opportunity_match(profile, opportunity)
        scored_opportunities.append(
            (
                match_score,
                opportunity.created_at,
                opportunity.id,
                _opportunity_recommendation_response(
                    opportunity=opportunity,
                    has_applied=opportunity.id in applied_opportunity_ids,
                    has_saved=opportunity.id in saved_opportunity_ids,
                    match_score=match_score,
                    match_reasons=match_reasons,
                ),
            )
        )

    scored_opportunities.sort(
        key=lambda item: (item[0], item[1], item[2]),
        reverse=True,
    )
    return [item[3] for item in scored_opportunities[:RECOMMENDATION_LIMIT]]


@router.patch(
    "/applications/{application_id}",
    response_model=OwnerOpportunityApplicationRead,
)
def update_application_status(
    application_id: int,
    request: OpportunityApplicationStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OwnerOpportunityApplicationRead:
    profile = _get_or_create_profile(db, current_user)
    application = _get_owner_loaded_application(db, application_id)
    if application.opportunity.owner_profile_id != profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opportunity owner can update this application",
        )

    if application.status not in OWNER_REVIEWABLE_APPLICATION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application status cannot be changed after review is complete",
        )

    application.status = request.status
    db.commit()
    if request.status in ("accepted", "rejected"):
        queue_push_to_users(
            db,
            background_tasks,
            [application.applicant_profile.user_id],
            title="Application update",
            body=(
                f'Your application to "{application.opportunity.title}" was '
                f"{request.status}."
            ),
            data={"tab": "applications"},
        )
    return _owner_application_response(_get_owner_loaded_application(db, application.id))


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_my_application(
    application_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    profile = _get_or_create_profile(db, current_user)
    application = db.scalar(
        select(OpportunityApplication).where(
            OpportunityApplication.id == application_id,
            OpportunityApplication.applicant_profile_id == profile.id,
        )
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    if application.status not in OWNER_REVIEWABLE_APPLICATION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application cannot be withdrawn after review is complete",
        )

    db.delete(application)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/opportunities", response_model=list[OpportunityRead])
def list_opportunities(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[OpportunityRead]:
    profile = _get_or_create_profile(db, current_user)
    list_filters = [
        or_(
            Opportunity.status == "open",
            Opportunity.owner_profile_id == profile.id,
        )
    ]
    blocked_ids = _blocked_profile_ids(db, profile.id)
    if blocked_ids:
        list_filters.append(Opportunity.owner_profile_id.not_in(blocked_ids))

    opportunities = db.scalars(
        select(Opportunity)
        .options(*_opportunity_load_options())
        .where(*list_filters)
        .order_by(Opportunity.created_at.desc(), Opportunity.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_opportunity_response(opportunity) for opportunity in opportunities]


@router.get("/opportunities/mine", response_model=list[OpportunityRead])
def list_my_owned_opportunities(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[OpportunityRead]:
    profile = _get_or_create_profile(db, current_user)
    opportunities = db.scalars(
        select(Opportunity)
        .options(*_opportunity_load_options())
        .where(Opportunity.owner_profile_id == profile.id)
        .order_by(Opportunity.created_at.desc(), Opportunity.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_opportunity_response(opportunity) for opportunity in opportunities]


@router.get("/opportunities/{opportunity_id}", response_model=OpportunityDetailRead)
def read_opportunity(
    opportunity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OpportunityDetailRead:
    profile = _get_or_create_profile(db, current_user)
    opportunity = _get_opportunity(db, opportunity_id)
    if (
        opportunity.status != "open" and opportunity.owner_profile_id != profile.id
    ) or opportunity.owner_profile_id in _blocked_profile_ids(db, profile.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )
    return _opportunity_detail_response(db, opportunity, profile)


@router.get(
    "/opportunities/{opportunity_id}/applications",
    response_model=list[OwnerOpportunityApplicationRead],
)
def list_opportunity_applications(
    opportunity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[OwnerOpportunityApplicationRead]:
    profile = _get_or_create_profile(db, current_user)
    opportunity = _get_opportunity(db, opportunity_id)
    if opportunity.owner_profile_id != profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opportunity owner can list applications",
        )

    applications = db.scalars(
        select(OpportunityApplication)
        .options(*_owner_application_load_options())
        .where(OpportunityApplication.opportunity_id == opportunity.id)
        .order_by(
            OpportunityApplication.created_at.desc(),
            OpportunityApplication.id.desc(),
        )
    ).all()
    return [_owner_application_response(application) for application in applications]


@router.post(
    "/opportunities",
    response_model=OpportunityRead,
    status_code=status.HTTP_201_CREATED,
)
def create_opportunity(
    request: OpportunityCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OpportunityRead:
    enforce_action_limit(opportunity_rate_limiter, current_user.id)
    profile = _get_or_create_profile(db, current_user)
    if request.type not in _allowed_opportunity_types(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_opportunity_authoring_detail(profile),
        )

    opportunity = Opportunity(
        owner_profile_id=profile.id,
        type=request.type,
        title=request.title,
        description=request.description,
        required_skills=request.required_skills,
        status=request.status,
    )
    db.add(opportunity)
    db.commit()
    return _opportunity_response(_get_opportunity(db, opportunity.id))


@router.patch("/opportunities/{opportunity_id}", response_model=OpportunityRead)
def update_opportunity(
    opportunity_id: int,
    request: OpportunityUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OpportunityRead:
    profile = _get_or_create_profile(db, current_user)
    opportunity = _get_opportunity(db, opportunity_id)
    if opportunity.owner_profile_id != profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opportunity owner can update this opportunity",
        )

    updates = request.model_dump(exclude_unset=True)
    if (
        "type" in updates
        and updates["type"] not in _allowed_opportunity_types(profile)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_opportunity_authoring_detail(profile),
        )

    for field, value in updates.items():
        setattr(opportunity, field, value)

    db.commit()
    return _opportunity_response(_get_opportunity(db, opportunity.id))


@router.post(
    "/opportunities/{opportunity_id}/apply",
    response_model=OpportunityApplicationRead,
    status_code=status.HTTP_201_CREATED,
)
def apply_to_opportunity(
    opportunity_id: int,
    request: Optional[OpportunityApplicationCreate] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OpportunityApplicationRead:
    enforce_action_limit(application_rate_limiter, current_user.id)
    profile = _get_or_create_profile(db, current_user)
    opportunity = _get_opportunity(db, opportunity_id)
    if opportunity.owner_profile_id in _blocked_profile_ids(db, profile.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )
    if opportunity.owner_profile_id == profile.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot apply to your own opportunity",
        )
    if opportunity.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Opportunity is not open for applications",
        )
    existing_application = db.scalar(
        select(OpportunityApplication).where(
            OpportunityApplication.opportunity_id == opportunity_id,
            OpportunityApplication.applicant_profile_id == profile.id,
        )
    )
    if existing_application is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Application already exists",
        )

    application = OpportunityApplication(
        opportunity_id=opportunity_id,
        applicant_profile_id=profile.id,
        status="submitted",
        note=request.note if request is not None else None,
    )
    db.add(application)
    _commit_or_conflict(db, "Application already exists")
    application = db.scalar(
        select(OpportunityApplication)
        .options(
            joinedload(OpportunityApplication.applicant_profile).joinedload(
                UserProfile.user
            )
        )
        .where(OpportunityApplication.id == application.id)
    )
    assert application is not None
    return _application_response(application)


@router.get("/connections/me", response_model=MyConnectionsRead)
def list_my_connections(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MyConnectionsRead:
    profile = _get_or_create_profile(db, current_user)
    sent_connections = db.scalars(
        select(ConnectionRequest)
        .options(*_connection_load_options())
        .where(ConnectionRequest.requester_profile_id == profile.id)
        .order_by(ConnectionRequest.created_at.desc(), ConnectionRequest.id.desc())
    ).all()
    received_connections = db.scalars(
        select(ConnectionRequest)
        .options(*_connection_load_options())
        .where(ConnectionRequest.receiver_profile_id == profile.id)
        .order_by(ConnectionRequest.created_at.desc(), ConnectionRequest.id.desc())
    ).all()
    return MyConnectionsRead(
        sent=[
            _connection_response(connection)
            for connection in sent_connections
        ],
        received=[
            _connection_response(connection)
            for connection in received_connections
        ],
    )


@router.post(
    "/connections/{profile_id}/request",
    response_model=ConnectionRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def request_connection(
    profile_id: int,
    background_tasks: BackgroundTasks,
    request: Optional[ConnectionRequestCreate] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ConnectionRequestRead:
    enforce_action_limit(connection_rate_limiter, current_user.id)
    requester_profile = _get_or_create_profile(db, current_user)
    receiver_profile = _get_profile(db, profile_id)
    if not _can_view_profile(
        requester_profile, receiver_profile
    ) or receiver_profile.id in _blocked_profile_ids(db, requester_profile.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    if requester_profile.id == receiver_profile.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request a connection with yourself",
        )

    existing_request = db.scalar(
        select(ConnectionRequest).where(
            or_(
                and_(
                    ConnectionRequest.requester_profile_id == requester_profile.id,
                    ConnectionRequest.receiver_profile_id == receiver_profile.id,
                ),
                and_(
                    ConnectionRequest.requester_profile_id == receiver_profile.id,
                    ConnectionRequest.receiver_profile_id == requester_profile.id,
                    ConnectionRequest.status.in_(("pending", "accepted")),
                ),
            )
        )
    )
    if existing_request is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Connection request already exists",
        )

    connection_request = ConnectionRequest(
        requester_profile_id=requester_profile.id,
        receiver_profile_id=receiver_profile.id,
        status="pending",
        message=request.message if request is not None else None,
    )
    db.add(connection_request)
    _commit_or_conflict(db, "Connection request already exists")
    connection_request = db.scalar(
        select(ConnectionRequest)
        .options(
            joinedload(ConnectionRequest.requester_profile).joinedload(
                UserProfile.user
            ),
            joinedload(ConnectionRequest.receiver_profile).joinedload(
                UserProfile.user
            ),
        )
        .where(ConnectionRequest.id == connection_request.id)
    )
    assert connection_request is not None
    queue_push_to_users(
        db,
        background_tasks,
        [receiver_profile.user_id],
        title="New connection request",
        body=f"{current_user.full_name} wants to connect with you.",
        data={"tab": "connections"},
    )
    return _connection_response(connection_request)


@router.patch("/connections/{connection_id}", response_model=ConnectionRequestRead)
def update_connection_status(
    connection_id: int,
    request: ConnectionRequestStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ConnectionRequestRead:
    profile = _get_or_create_profile(db, current_user)
    connection = db.scalar(
        select(ConnectionRequest)
        .options(*_connection_load_options())
        .where(ConnectionRequest.id == connection_id)
    )
    if connection is None or profile.id not in (
        connection.requester_profile_id,
        connection.receiver_profile_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection request not found",
        )
    if connection.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection request has already been resolved",
        )

    if request.status == "canceled":
        if connection.requester_profile_id != profile.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the requester can cancel a connection request",
            )
    elif connection.receiver_profile_id != profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the receiver can accept or decline a connection request",
        )

    connection.status = request.status
    db.commit()
    if request.status == "accepted":
        queue_push_to_users(
            db,
            background_tasks,
            [connection.requester_profile.user_id],
            title="Connection accepted",
            body=f"{current_user.full_name} accepted your connection request.",
            data={"tab": "connections"},
        )
    return _connection_response(connection)


@router.post(
    "/opportunities/{opportunity_id}/save",
    response_model=SavedOpportunityRead,
    status_code=status.HTTP_201_CREATED,
)
def save_opportunity(
    opportunity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> SavedOpportunityRead:
    profile = _get_or_create_profile(db, current_user)
    _get_opportunity(db, opportunity_id)
    existing_save = db.scalar(
        select(SavedOpportunity).where(
            SavedOpportunity.profile_id == profile.id,
            SavedOpportunity.opportunity_id == opportunity_id,
        )
    )
    if existing_save is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Opportunity already saved",
        )

    saved_opportunity = SavedOpportunity(
        profile_id=profile.id,
        opportunity_id=opportunity_id,
    )
    db.add(saved_opportunity)
    _commit_or_conflict(db, "Opportunity already saved")
    db.refresh(saved_opportunity)
    return SavedOpportunityRead.model_validate(saved_opportunity)


@router.delete(
    "/opportunities/{opportunity_id}/save",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unsave_opportunity(
    opportunity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    profile = _get_or_create_profile(db, current_user)
    saved_opportunity = db.scalar(
        select(SavedOpportunity).where(
            SavedOpportunity.profile_id == profile.id,
            SavedOpportunity.opportunity_id == opportunity_id,
        )
    )
    if saved_opportunity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved opportunity not found",
        )

    db.delete(saved_opportunity)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/reports", response_model=ContentReportRead, status_code=status.HTTP_201_CREATED)
def report_content(
    request: ContentReportCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ContentReportRead:
    enforce_action_limit(report_rate_limiter, current_user.id)
    reporter_profile = _get_or_create_profile(db, current_user)

    target_profile_id: int | None = None
    target_opportunity_id: int | None = None
    if request.target_type == "profile":
        target = _get_profile(db, request.target_id)
        if target.id == reporter_profile.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot report your own profile",
            )
        target_profile_id = target.id
    else:
        opportunity = _get_opportunity(db, request.target_id)
        if opportunity.owner_profile_id == reporter_profile.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot report your own post",
            )
        target_opportunity_id = opportunity.id

    existing = db.scalar(
        select(ContentReport).where(
            ContentReport.reporter_profile_id == reporter_profile.id,
            ContentReport.target_type == request.target_type,
            ContentReport.target_profile_id == target_profile_id,
            ContentReport.target_opportunity_id == target_opportunity_id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already reported this content",
        )

    report = ContentReport(
        reporter_profile_id=reporter_profile.id,
        target_type=request.target_type,
        target_profile_id=target_profile_id,
        target_opportunity_id=target_opportunity_id,
        reason=request.reason,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ContentReportRead(
        id=report.id,
        target_type=request.target_type,
        target_id=request.target_id,
        created_at=report.created_at,
    )


@router.get("/blocks/me", response_model=list[ProfileSummary])
def list_my_blocks(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[ProfileSummary]:
    profile = _get_or_create_profile(db, current_user)
    blocks = db.scalars(
        select(ProfileBlock)
        .options(
            joinedload(ProfileBlock.blocked_profile).joinedload(UserProfile.user)
        )
        .where(ProfileBlock.blocker_profile_id == profile.id)
        .order_by(ProfileBlock.created_at.desc(), ProfileBlock.id.desc())
    ).all()
    return [_profile_summary(block.blocked_profile) for block in blocks]


@router.post("/blocks/{profile_id}", response_model=ProfileSummary, status_code=status.HTTP_201_CREATED)
def block_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ProfileSummary:
    blocker_profile = _get_or_create_profile(db, current_user)
    target = _get_profile(db, profile_id)
    if target.id == blocker_profile.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot block yourself",
        )

    existing = db.scalar(
        select(ProfileBlock).where(
            ProfileBlock.blocker_profile_id == blocker_profile.id,
            ProfileBlock.blocked_profile_id == target.id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile is already blocked",
        )

    db.add(
        ProfileBlock(
            blocker_profile_id=blocker_profile.id,
            blocked_profile_id=target.id,
        )
    )
    _commit_or_conflict(db, "Profile is already blocked")
    return _profile_summary(target)


@router.delete("/blocks/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def unblock_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    blocker_profile = _get_or_create_profile(db, current_user)
    block = db.scalar(
        select(ProfileBlock).where(
            ProfileBlock.blocker_profile_id == blocker_profile.id,
            ProfileBlock.blocked_profile_id == profile_id,
        )
    )
    if block is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found",
        )

    db.delete(block)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
