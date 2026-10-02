from datetime import datetime
from typing import Optional

from pydantic import computed_field

from app.core.legal import CURRENT_TERMS_VERSION
from app.schemas.base import ReadSchema


class UserRead(ReadSchema):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    terms_version: Optional[str] = None
    terms_accepted_at: Optional[datetime] = None
    age_confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def current_terms_version(self) -> str:
        return CURRENT_TERMS_VERSION

    @computed_field  # type: ignore[prop-decorator]
    @property
    def terms_acceptance_required(self) -> bool:
        """True until this user has accepted the current terms and confirmed
        their age; the app blocks use behind an acceptance screen meanwhile."""
        return (
            self.terms_version != CURRENT_TERMS_VERSION
            or self.terms_accepted_at is None
            or self.age_confirmed_at is None
        )
