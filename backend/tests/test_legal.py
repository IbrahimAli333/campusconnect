"""Consent, data export, and account-deletion completeness."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, or_, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.legal import CURRENT_TERMS_VERSION, MINIMUM_AGE
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.connection_request import ConnectionRequest
from app.models.content_report import ContentReport
from app.models.message import Message
from app.models.opportunity import Opportunity
from app.models.opportunity_application import OpportunityApplication
from app.models.profile_block import ProfileBlock
from app.models.push_token import PushToken
from app.models.resume_entry import ResumeEntry
from app.models.saved_opportunity import SavedOpportunity
from app.models.skill import Skill
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.user_skill import UserSkill


PASSWORD = "legal-test-password"


@pytest.fixture()
def client_and_sessionmaker() -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    app = create_app()

    def override_get_db() -> Iterator[Session]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client, testing_session_local

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _register(client: TestClient, email: str, **consent: bool) -> object:
    return client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": "Consent Tester",
            **consent,
        },
    )


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login(client: TestClient, email: str) -> str:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _make_user(db: Session, email: str, name: str) -> tuple[User, UserProfile]:
    user = User(
        email=email,
        hashed_password=hash_password(PASSWORD),
        full_name=name,
        role="member",
        is_active=True,
    )
    db.add(user)
    db.flush()
    profile = UserProfile(user_id=user.id, role="member", visibility="public")
    db.add(profile)
    db.flush()
    return user, profile


class TestSignupConsent:
    def test_register_requires_both_consent_boxes(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = client_and_sessionmaker

        # App 1.1.0+ always sends both fields, ticked or not.
        assert (
            _register(client, "a@example.edu", accept_terms=False, confirm_age=False).status_code
            == 400
        )
        assert _register(client, "b@example.edu", accept_terms=True).status_code == 400
        assert _register(client, "c@example.edu", confirm_age=True).status_code == 400

        with session_local() as db:
            assert db.scalars(select(User)).all() == []

    def test_register_records_current_terms_version_and_age(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = client_and_sessionmaker

        response = _register(
            client, "ok@example.edu", accept_terms=True, confirm_age=True
        )
        assert response.status_code == 201
        user = response.json()["user"]
        assert user["terms_version"] == CURRENT_TERMS_VERSION
        assert user["current_terms_version"] == CURRENT_TERMS_VERSION
        assert user["terms_accepted_at"] is not None
        assert user["age_confirmed_at"] is not None
        assert user["terms_acceptance_required"] is False

        with session_local() as db:
            stored = db.scalar(select(User).where(User.email == "ok@example.edu"))
            assert stored is not None
            assert stored.terms_version == CURRENT_TERMS_VERSION

    def test_pre_consent_build_can_still_register_but_must_accept_later(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = client_and_sessionmaker

        # Builds before 1.1.0 have no consent boxes and send neither field.
        response = _register(client, "old-app@example.edu")
        assert response.status_code == 201
        user = response.json()["user"]
        assert user["terms_version"] is None
        assert user["terms_accepted_at"] is None
        assert user["age_confirmed_at"] is None
        assert user["terms_acceptance_required"] is True

        with session_local() as db:
            stored = db.scalar(select(User).where(User.email == "old-app@example.edu"))
            assert stored is not None
            assert stored.age_confirmed_at is None

    def test_pre_consent_build_blocked_once_terms_are_enforced(
        self,
        client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from app.core.config import get_settings

        client, session_local = client_and_sessionmaker
        monkeypatch.setenv("UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE", "true")
        get_settings.cache_clear()
        try:
            assert _register(client, "old-app@example.edu").status_code == 400
            with session_local() as db:
                assert db.scalars(select(User)).all() == []
        finally:
            monkeypatch.delenv("UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE")
            get_settings.cache_clear()

    def test_legal_info_is_public(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, _ = client_and_sessionmaker
        response = client.get("/api/v1/auth/legal")
        assert response.status_code == 200
        body = response.json()
        assert body["terms_version"] == CURRENT_TERMS_VERSION
        assert body["minimum_age"] == MINIMUM_AGE == 18
        assert body["terms_url"].endswith("/terms.html")
        assert body["privacy_policy_url"].endswith("/privacy-policy.html")


class TestReacceptance:
    def test_existing_user_without_consent_must_accept(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = client_and_sessionmaker
        with session_local() as db:
            _make_user(db, "legacy@example.edu", "Legacy User")
            db.commit()

        token = _login(client, "legacy@example.edu")
        me = client.get("/api/v1/auth/me", headers=_headers(token)).json()
        assert me["terms_version"] is None
        assert me["terms_acceptance_required"] is True

        # Ticking only one box is not enough.
        response = client.post(
            "/api/v1/auth/accept-terms",
            headers=_headers(token),
            json={"terms_version": CURRENT_TERMS_VERSION, "accept_terms": True},
        )
        assert response.status_code == 400

        response = client.post(
            "/api/v1/auth/accept-terms",
            headers=_headers(token),
            json={
                "terms_version": CURRENT_TERMS_VERSION,
                "accept_terms": True,
                "confirm_age": True,
            },
        )
        assert response.status_code == 200
        assert response.json()["terms_acceptance_required"] is False

    def test_outdated_version_requires_reacceptance(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = client_and_sessionmaker
        response = _register(
            client, "old@example.edu", accept_terms=True, confirm_age=True
        )
        token = response.json()["access_token"]
        with session_local() as db:
            user = db.scalar(select(User).where(User.email == "old@example.edu"))
            assert user is not None
            user.terms_version = "2000-01-01"
            db.commit()

        me = client.get("/api/v1/auth/me", headers=_headers(token)).json()
        assert me["terms_acceptance_required"] is True

        # Accepting a version other than the current one is refused.
        stale = client.post(
            "/api/v1/auth/accept-terms",
            headers=_headers(token),
            json={"terms_version": "2000-01-01", "accept_terms": True, "confirm_age": True},
        )
        assert stale.status_code == 409

    def test_accept_terms_requires_auth(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, _ = client_and_sessionmaker
        response = client.post(
            "/api/v1/auth/accept-terms",
            json={"terms_version": CURRENT_TERMS_VERSION, "accept_terms": True, "confirm_age": True},
        )
        assert response.status_code == 401


def _seed_full_footprint(db: Session) -> tuple[int, int]:
    """Give one user a row in every table that can reference them."""
    user, profile = _make_user(db, "leaver@example.edu", "Leaving User")
    other_user, other = _make_user(db, "stayer@example.edu", "Staying User")

    skill = Skill(name="Python")
    db.add(skill)
    db.flush()
    db.add(UserSkill(profile_id=profile.id, skill_id=skill.id, level="advanced"))
    db.add(ResumeEntry(profile_id=profile.id, entry_type="project", title="Thesis"))

    my_post = Opportunity(
        owner_profile_id=profile.id, type="project", title="My post", description="d",
        required_skills=["Python"], status="open",
    )
    other_post = Opportunity(
        owner_profile_id=other.id, type="project", title="Other post", description="d",
        required_skills=[], status="open",
    )
    db.add_all([my_post, other_post])
    db.flush()

    db.add_all(
        [
            OpportunityApplication(opportunity_id=other_post.id, applicant_profile_id=profile.id, note="hi"),
            OpportunityApplication(opportunity_id=my_post.id, applicant_profile_id=other.id),
            SavedOpportunity(profile_id=profile.id, opportunity_id=other_post.id),
            SavedOpportunity(profile_id=other.id, opportunity_id=my_post.id),
            ConnectionRequest(requester_profile_id=profile.id, receiver_profile_id=other.id, status="accepted"),
            Message(sender_profile_id=profile.id, recipient_profile_id=other.id, body="sent"),
            Message(sender_profile_id=other.id, recipient_profile_id=profile.id, body="received"),
            ProfileBlock(blocker_profile_id=other.id, blocked_profile_id=profile.id),
            ContentReport(reporter_profile_id=profile.id, target_type="opportunity", target_opportunity_id=other_post.id),
            ContentReport(reporter_profile_id=other.id, target_type="profile", target_profile_id=profile.id),
            PushToken(user_id=user.id, token="ExponentPushToken[leaver-device-0001]", platform="ios"),
            PushToken(user_id=other_user.id, token="ExponentPushToken[stayer-device-0001]", platform="android"),
        ]
    )
    db.commit()
    return user.id, profile.id


class TestDataExport:
    def test_export_contains_the_users_data(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = client_and_sessionmaker
        with session_local() as db:
            _seed_full_footprint(db)

        token = _login(client, "leaver@example.edu")
        response = client.get("/api/v1/auth/me/export", headers=_headers(token))
        assert response.status_code == 200
        data = response.json()

        assert data["account"]["email"] == "leaver@example.edu"
        assert "hashed_password" not in str(data)
        assert [skill["name"] for skill in data["skills"]] == ["Python"]
        assert data["portfolio_entries"][0]["title"] == "Thesis"
        assert data["opportunities_posted"][0]["applications_received"] == 1
        assert data["applications_submitted"][0]["note"] == "hi"
        assert data["saved_opportunities"][0]["opportunity_title"] == "Other post"
        assert data["connections"][0]["other_person"] == "Staying User"
        assert {m["body"] for m in data["messages"]} == {"sent", "received"}
        assert len(data["reports_filed"]) == 1
        # The push token is recognisable but not usable.
        assert data["push_notification_devices"][0]["token"].endswith("...")
        # Reports against the user stay anonymous: no reporter identity leaks.
        assert "reports_against_you" not in data

    def test_export_requires_auth(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, _ = client_and_sessionmaker
        assert client.get("/api/v1/auth/me/export").status_code == 401


class TestAccountDeletionCompleteness:
    def test_delete_account_removes_every_row_about_the_user(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = client_and_sessionmaker
        with session_local() as db:
            user_id, profile_id = _seed_full_footprint(db)

        token = _login(client, "leaver@example.edu")
        response = client.post(
            "/api/v1/auth/delete-account",
            headers=_headers(token),
            json={"password": PASSWORD},
        )
        assert response.status_code == 204

        with session_local() as db:
            def count(model, *criteria) -> int:
                return db.scalar(select(func.count()).select_from(model).where(*criteria))

            assert count(User, User.id == user_id) == 0
            assert count(UserProfile, UserProfile.id == profile_id) == 0
            assert count(PushToken, PushToken.user_id == user_id) == 0
            assert count(UserSkill, UserSkill.profile_id == profile_id) == 0
            assert count(ResumeEntry, ResumeEntry.profile_id == profile_id) == 0
            assert count(Opportunity, Opportunity.owner_profile_id == profile_id) == 0
            assert count(
                OpportunityApplication,
                OpportunityApplication.applicant_profile_id == profile_id,
            ) == 0
            assert count(SavedOpportunity, SavedOpportunity.profile_id == profile_id) == 0
            assert count(
                ConnectionRequest,
                or_(
                    ConnectionRequest.requester_profile_id == profile_id,
                    ConnectionRequest.receiver_profile_id == profile_id,
                ),
            ) == 0
            assert count(
                Message,
                or_(
                    Message.sender_profile_id == profile_id,
                    Message.recipient_profile_id == profile_id,
                ),
            ) == 0
            assert count(
                ProfileBlock,
                or_(
                    ProfileBlock.blocker_profile_id == profile_id,
                    ProfileBlock.blocked_profile_id == profile_id,
                ),
            ) == 0
            assert count(
                ContentReport,
                or_(
                    ContentReport.reporter_profile_id == profile_id,
                    ContentReport.target_profile_id == profile_id,
                ),
            ) == 0

            # The other user's own data survives: their post, push token,
            # and the shared skill catalogue entry.
            assert count(Opportunity, Opportunity.title == "Other post") == 1
            assert count(PushToken, PushToken.token.like("%stayer%")) == 1
            assert count(Skill) == 1
            # Their application to the deleted user's post went with the post.
            assert count(OpportunityApplication) == 0


class TestServerSideTermsEnforcement:
    @pytest.fixture()
    def enforced(self, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
        from app.core.config import get_settings

        monkeypatch.setenv("UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE", "true")
        get_settings.cache_clear()
        yield
        monkeypatch.delenv("UNIVERSITY_PORTAL_ENFORCE_TERMS_ACCEPTANCE")
        get_settings.cache_clear()

    def test_feature_endpoints_wait_for_acceptance_but_account_endpoints_do_not(
        self,
        client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
        enforced: None,
    ) -> None:
        client, session_local = client_and_sessionmaker
        with session_local() as db:
            _make_user(db, "legacy@example.edu", "Legacy User")
            db.commit()
        headers = _headers(_login(client, "legacy@example.edu"))

        blocked = client.get("/api/v1/network/me", headers=headers)
        assert blocked.status_code == 428
        assert client.get("/api/v1/network/messages/unread", headers=headers).status_code == 428
        assert (
            client.post(
                "/api/v1/notifications/tokens",
                headers=headers,
                json={"token": "ExponentPushToken[x]"},
            ).status_code
            == 428
        )

        # People can always read their account, export, unregister, or accept.
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
        assert client.get("/api/v1/auth/me/export", headers=headers).status_code == 200
        assert (
            client.post(
                "/api/v1/notifications/tokens/unregister",
                headers=headers,
                json={"token": "ExponentPushToken[x]"},
            ).status_code
            == 204
        )
        accepted = client.post(
            "/api/v1/auth/accept-terms",
            headers=headers,
            json={"terms_version": CURRENT_TERMS_VERSION, "accept_terms": True, "confirm_age": True},
        )
        assert accepted.status_code == 200
        assert client.get("/api/v1/network/me", headers=headers).status_code == 200

    def test_enforcement_is_off_by_default(
        self, client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]]
    ) -> None:
        client, session_local = client_and_sessionmaker
        with session_local() as db:
            _make_user(db, "legacy@example.edu", "Legacy User")
            db.commit()
        headers = _headers(_login(client, "legacy@example.edu"))
        assert client.get("/api/v1/network/me", headers=headers).status_code == 200


class TestContentConsentBeforeGlobalRollout:
    @pytest.mark.parametrize(
        ("method", "path", "payload"),
        [
            ("patch", "/me", {"bio": "New biography"}),
            ("post", "/me/skills", {"name": "Python", "level": "advanced"}),
            ("patch", "/me/skills/1", {"level": "expert"}),
            ("post", "/me/resume", {"entry_type": "project", "title": "Project"}),
            ("patch", "/me/resume/1", {"title": "Changed project"}),
            ("post", "/opportunities", {"type": "project", "title": "Project", "description": "Description"}),
            ("patch", "/opportunities/1", {"description": "Changed description"}),
            ("post", "/opportunities/1/apply", {"note": "Application note"}),
            ("post", "/connections/2/request", {"message": "Connection note"}),
            ("post", "/messages/threads/2", {"body": "Message"}),
            ("post", "/assistant", {"query": "Research project"}),
        ],
    )
    @pytest.mark.parametrize("consent_state", ["missing", "outdated", "missing_timestamp", "missing_age"])
    def test_unaccepted_content_is_rejected_before_processing(
        self, client_and_sessionmaker, monkeypatch, method, path, payload, consent_state
    ) -> None:
        from datetime import datetime, timezone
        from app.core.config import get_settings
        from app.services import assistant

        monkeypatch.setattr(get_settings(), "enforce_terms_acceptance", False)
        client, session_local = client_and_sessionmaker
        with session_local() as db:
            user, _ = _make_user(db, "legacy@example.edu", "Legacy User")
            if consent_state != "missing":
                user.terms_version = "2000-01-01" if consent_state == "outdated" else CURRENT_TERMS_VERSION
                if consent_state != "missing_age":
                    user.age_confirmed_at = datetime.now(timezone.utc)
                if consent_state != "missing_timestamp":
                    user.terms_accepted_at = datetime.now(timezone.utc)
            db.commit()

        def unexpected_assistant_call(*args, **kwargs):
            pytest.fail("Unaccepted content must not reach the external assistant")

        monkeypatch.setattr(assistant, "find_matching_posts", unexpected_assistant_call)
        headers = _headers(_login(client, "legacy@example.edu"))
        assert client.get("/api/v1/auth/me", headers=headers).json()["terms_acceptance_required"] is True
        response = client.request(method, f"/api/v1/network{path}", headers=headers, json=payload)
        assert response.status_code == 428, response.text
        # Consent is checked before role/object/provider checks or content writes.
        with session_local() as db:
            for model in (Opportunity, Message, ResumeEntry, UserSkill, ConnectionRequest, OpportunityApplication):
                assert db.scalar(select(func.count(model.id))) == 0
            assert db.scalar(select(UserProfile.bio)) is None

    def test_legacy_reads_and_account_controls_then_acceptance_restore_writes(
        self, client_and_sessionmaker, monkeypatch
    ) -> None:
        from app.core.config import get_settings

        monkeypatch.setattr(get_settings(), "enforce_terms_acceptance", False)
        client, _ = client_and_sessionmaker
        response = _register(client, "old-build@example.edu")
        assert response.status_code == 201
        headers = _headers(response.json()["access_token"])
        for path in ("/auth/me", "/auth/me/export", "/network/me", "/network/opportunities", "/network/messages/threads"):
            assert client.get(f"/api/v1{path}", headers=headers).status_code == 200
        assert client.patch("/api/v1/network/me", headers=headers, json={"bio": "Before"}).status_code == 428
        accepted = client.post(
            "/api/v1/auth/accept-terms", headers=headers,
            json={"terms_version": CURRENT_TERMS_VERSION, "accept_terms": True, "confirm_age": True},
        )
        assert accepted.status_code == 200
        changed = client.patch("/api/v1/network/me", headers=headers, json={"bio": "After"})
        assert changed.status_code == 200
        assert changed.json()["bio"] == "After"

    @pytest.mark.parametrize("enforce_all", [False, True])
    def test_safety_and_exit_controls_do_not_require_acceptance(
        self, client_and_sessionmaker, monkeypatch, enforce_all
    ) -> None:
        from app.core.config import get_settings

        monkeypatch.setattr(get_settings(), "enforce_terms_acceptance", enforce_all)
        client, session_local = client_and_sessionmaker
        with session_local() as db:
            _make_user(db, "legacy@example.edu", "Legacy User")
            _, other = _make_user(db, "other@example.edu", "Other User")
            other_id = other.id
            db.commit()
        headers = _headers(_login(client, "legacy@example.edu"))
        assert client.post(
            "/api/v1/network/reports", headers=headers,
            json={"target_type": "profile", "target_id": other_id},
        ).status_code == 201
        block_path = f"/api/v1/network/blocks/{other_id}"
        assert client.post(block_path, headers=headers).status_code == 201
        assert client.get("/api/v1/network/blocks/me", headers=headers).json()[0]["id"] == other_id
        assert client.delete(block_path, headers=headers).status_code == 204
        assert client.get("/api/v1/auth/me/export", headers=headers).status_code == 200
        assert client.post(
            "/api/v1/auth/delete-account", headers=headers, json={"password": PASSWORD}
        ).status_code == 204
