from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_current_terms
from app.db.session import get_db
from app.models.push_token import PushToken
from app.models.user import User
from app.schemas.notifications import (
    PushTokenRead,
    PushTokenRegister,
    PushTokenUnregister,
)


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post(
    "/tokens",
    response_model=PushTokenRead,
    status_code=status.HTTP_201_CREATED,
)
def register_push_token(
    request: PushTokenRegister,
    # Unregistering (logout, the Me tab switch) stays open without consent.
    current_user: User = Depends(require_current_terms),
    db: Session = Depends(get_db),
) -> PushTokenRead:
    push_token = db.scalar(
        select(PushToken).where(PushToken.token == request.token)
    )
    if push_token is None:
        push_token = PushToken(
            user_id=current_user.id,
            token=request.token,
            platform=request.platform,
            language=request.language,
        )
        db.add(push_token)
    else:
        # A device token follows whoever is signed in on that device. The app
        # re-registers when its language changes, which updates it here.
        push_token.user_id = current_user.id
        push_token.platform = request.platform
        push_token.language = request.language

    db.commit()
    db.refresh(push_token)
    return PushTokenRead.model_validate(push_token)


@router.post("/tokens/unregister", status_code=status.HTTP_204_NO_CONTENT)
def unregister_push_token(
    request: PushTokenUnregister,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    push_token = db.scalar(
        select(PushToken).where(
            PushToken.token == request.token,
            PushToken.user_id == current_user.id,
        )
    )
    if push_token is not None:
        db.delete(push_token)
        db.commit()
    # Idempotent so logout never fails on an already-removed token.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
