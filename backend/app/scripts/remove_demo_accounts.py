"""Remove the demo accounts from production.

The local seed (seed_dev) and the old release-preview script both create
demo accounts with passwords written in this repository, plus demo posts.
Real people must never see them or be able to log in as them, so the Render
pre-deploy step deletes them on every production deploy. Deleting the user
removes everything linked to it (profile, posts, messages, connections,
applications), exactly like in-app account deletion.

The admin and store-review accounts are never touched: only the exact
addresses below are removed.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User

DEMO_ACCOUNT_EMAILS = (
    "member@example.edu",
    "student@example.edu",
    "teacher@example.edu",
    "professor@example.edu",
    "mentor@example.edu",
    "employer@example.edu",
)


def remove_demo_accounts(db: Session) -> list[str]:
    """Delete every demo account that exists and return their emails."""
    users = db.scalars(select(User).where(User.email.in_(DEMO_ACCOUNT_EMAILS))).all()
    removed = sorted(user.email for user in users)
    for user in users:
        db.delete(user)
    db.commit()
    return removed
