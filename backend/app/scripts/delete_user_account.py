"""Owner-operated account deletion after independently verified email requests.

Dry-run by default. This module neither verifies mailbox ownership nor sends
email; the operator must complete the documented verification procedure first.
No application database is imported until the CLI is actually invoked.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.announcement import Announcement
from app.models.material import Material
from app.models.push_token import PushToken
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.services.account_deletion import delete_user_account


class OperatorDeletionError(ValueError):
    """A safe, content-free operator error."""


def _find_user(db: Session, user_id: int, email: str, *, lock: bool) -> User | None:
    query = select(User).where(User.id == user_id)
    if lock:
        query = query.with_for_update()
    user = db.scalar(query)
    if user is not None and user.email != email:
        raise OperatorDeletionError("Account ID and email do not match; nothing deleted.")
    if user is None and db.scalar(select(User.id).where(User.email == email)) is not None:
        raise OperatorDeletionError("Email belongs to a different account ID; nothing deleted.")
    return user


def _authored_ids(db: Session, user_id: int) -> tuple[list[int], list[int]]:
    announcements = list(db.scalars(select(Announcement.id).where(
        Announcement.published_by_user_id == user_id
    )))
    materials = list(db.scalars(select(Material.id).join(TeacherProfile).where(
        TeacherProfile.user_id == user_id
    )))
    return announcements, materials


def process_request(
    session_factory: Callable[[], Session],
    *,
    user_id: int,
    email: str,
    execute: bool = False,
    ownership_confirmed: bool = False,
    request_reference: str | None = None,
    confirmation: str | None = None,
) -> dict[str, object]:
    """Preview, or delete exactly one verified account in an owned transaction.

The helper is shared with self-service. Output deliberately omits email,
content, credentials and delivery tokens. PostgreSQL locks the account row
when executing; a fresh identity check occurs after the operator confirms.
"""
    email = email.strip().lower()
    if user_id <= 0 or not email:
        raise OperatorDeletionError("A positive user ID and matching email are required.")
    if execute:
        if not ownership_confirmed:
            raise OperatorDeletionError("Verify account ownership before execution.")
        if not request_reference or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", request_reference):
            raise OperatorDeletionError("A non-sensitive request reference is required.")
        if confirmation != f"DELETE USER {user_id}":
            raise OperatorDeletionError("Exact operator confirmation required; nothing deleted.")

    with session_factory() as db, db.begin():
        user = _find_user(db, user_id, email, lock=execute)
        if user is None:
            return {"status": "already_absent", "user_id": user_id}
        announcement_ids, material_ids = _authored_ids(db, user_id)
        counts = {
            "users": 1,
            "announcements": len(announcement_ids),
            "material_listings": len(material_ids),
            "push_tokens": len(list(db.scalars(select(PushToken.id).where(PushToken.user_id == user_id)))),
            "network_profiles": int(user.network_profile is not None),
            "student_profiles": int(user.student_profile is not None),
            "teacher_profiles": int(user.teacher_profile is not None),
        }
        if not execute:
            return {"status": "dry_run", "user_id": user_id, "direct_counts": counts,
                    "scope": "Includes existing account cascades and authored listings; counts are not a total of every dependent row."}
        delete_user_account(db, user)

    # Verify in a new transaction after commit; saved row IDs also detect an
    # accidental author-unlink implementation that would hide residual text.
    with session_factory() as db:
        remaining = (
            db.get(User, user_id) is not None
            or db.scalar(select(Announcement.id).where(Announcement.id.in_(announcement_ids)).limit(1)) is not None
            or db.scalar(select(Material.id).where(Material.id.in_(material_ids)).limit(1)) is not None
        )
        if remaining:
            raise OperatorDeletionError("Deletion committed but verification failed; investigate before reporting completion.")
    return {"status": "deleted", "user_id": user_id, "request_reference": request_reference,
            "direct_counts": counts, "database_verified": True,
            "provider_and_support_cleanup": "Separate assessment required; not performed by this command."}


def main(argv: list[str] | None = None, *, session_factory: Callable[[], Session] | None = None,
         prompt: Callable[[str], str] = input) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", required=True, type=int)
    parser.add_argument("--email", required=True, help="Must match the independently verified account email")
    parser.add_argument("--execute", action="store_true", help="Opt in to permanent deletion after preview")
    parser.add_argument("--ownership-confirmed", action="store_true", help="Attest that independent ownership verification is complete")
    parser.add_argument("--request-reference", help="Non-sensitive request reference; no email or message text")
    args = parser.parse_args(argv)
    try:
        if session_factory is None:
            from app.db.session import SessionLocal
            session_factory = SessionLocal
        preview = process_request(session_factory, user_id=args.user_id, email=args.email)
        print(json.dumps(preview, sort_keys=True))
        if not args.execute or preview["status"] == "already_absent":
            return 0
        if not args.ownership_confirmed or not args.request_reference:
            raise OperatorDeletionError("Execution requires verified ownership and a request reference.")
        confirmation = prompt(f"Permanently remove this account, authored listings and cascaded data? Type DELETE USER {args.user_id}: ")
        result = process_request(session_factory, user_id=args.user_id, email=args.email, execute=True,
                                 ownership_confirmed=args.ownership_confirmed,
                                 request_reference=args.request_reference, confirmation=confirmation)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (EOFError, KeyboardInterrupt):
        print("Cancelled; no execution confirmation received.", file=sys.stderr)
        return 1
    except OperatorDeletionError as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception:
        # DB exception text can contain credentials, parameters or private data.
        print("Database operation failed. Verify the exact account's state before retrying; the outcome may be unknown.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
