from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
import app.services.push as push_service
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.models.opportunity import Opportunity
from app.models.push_token import PushToken
from app.models.user import User
from app.models.user_profile import UserProfile
from app.scripts.seed_dev import DEV_CREDENTIALS, seed_dev


EMPLOYER_CREDENTIALS = {
    "email": "employer@example.edu",
    "password": "employer-password",
}


@pytest.fixture()
def seeded_client_and_sessionmaker() -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        seed_dev(db)

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


@pytest.fixture()
def captured_pushes(monkeypatch: pytest.MonkeyPatch) -> list[list[dict[str, Any]]]:
    batches: list[list[dict[str, Any]]] = []

    def fake_post_expo_push(messages: list[dict[str, Any]]) -> dict[str, Any]:
        batches.append(messages)
        return {"data": [{"status": "ok"} for _ in messages]}

    monkeypatch.setattr(push_service, "_post_expo_push", fake_post_expo_push)
    return batches


def _login_with(client: TestClient, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    accepted = client.post(
        "/api/v1/auth/accept-terms",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "terms_version": response.json()["user"]["current_terms_version"],
            "accept_terms": True,
            "confirm_age": True,
        },
    )
    assert accepted.status_code == 200
    return token


def _login(client: TestClient, role: str) -> str:
    credentials = DEV_CREDENTIALS[role]
    return _login_with(client, credentials["email"], credentials["password"])


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_push_token(
    client: TestClient,
    token: str,
    push_token: str,
    platform: str = "android",
    language: str | None = "en",
) -> dict[str, Any]:
    payload: dict[str, Any] = {"token": push_token, "platform": platform}
    if language is not None:
        payload["language"] = language
    response = client.post(
        "/api/v1/notifications/tokens",
        headers=_auth_headers(token),
        json=payload,
    )
    assert response.status_code == 201
    return response.json()


def _profile_id_for_email(
    testing_session_local: sessionmaker[Session],
    email: str,
) -> int:
    with testing_session_local() as db:
        profile_id = db.scalar(
            select(UserProfile.id).join(User).where(User.email == email)
        )
    assert profile_id is not None
    return profile_id


def _opportunity_id_by_type(
    testing_session_local: sessionmaker[Session],
    opportunity_type: str,
) -> int:
    with testing_session_local() as db:
        opportunity_id = db.scalar(
            select(Opportunity.id)
            .where(Opportunity.type == opportunity_type)
            .order_by(Opportunity.id)
        )
    assert opportunity_id is not None
    return opportunity_id


def _all_pushes(batches: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    return [message for batch in batches for message in batch]


def test_register_reassign_and_unregister_push_token(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    member_token = _login(client, "member")

    registered = _register_push_token(
        client, student_token, "ExponentPushToken[shared-device]"
    )
    assert registered["token"] == "ExponentPushToken[shared-device]"
    assert registered["platform"] == "android"

    # The same device token re-registered by another user moves to that user.
    _register_push_token(client, member_token, "ExponentPushToken[shared-device]")
    with testing_session_local() as db:
        owners = db.scalars(
            select(User.email)
            .join(PushToken, PushToken.user_id == User.id)
            .where(PushToken.token == "ExponentPushToken[shared-device]")
        ).all()
    assert owners == [DEV_CREDENTIALS["member"]["email"]]

    unregister = client.post(
        "/api/v1/notifications/tokens/unregister",
        headers=_auth_headers(member_token),
        json={"token": "ExponentPushToken[shared-device]"},
    )
    assert unregister.status_code == 204
    with testing_session_local() as db:
        remaining = db.scalar(
            select(PushToken.id).where(
                PushToken.token == "ExponentPushToken[shared-device]"
            )
        )
    assert remaining is None

    # Unregistering an unknown token stays idempotent for logout flows.
    repeat = client.post(
        "/api/v1/notifications/tokens/unregister",
        headers=_auth_headers(member_token),
        json={"token": "ExponentPushToken[shared-device]"},
    )
    assert repeat.status_code == 204


def test_push_token_endpoints_require_authentication(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = seeded_client_and_sessionmaker
    response = client.post(
        "/api/v1/notifications/tokens",
        json={"token": "ExponentPushToken[anonymous]"},
    )
    assert response.status_code == 401


def test_connection_request_pushes_to_receiver(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    _register_push_token(client, teacher_token, "ExponentPushToken[teacher]")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
    )

    assert response.status_code == 201
    pushes = _all_pushes(captured_pushes)
    assert len(pushes) == 1
    assert pushes[0]["to"] == "ExponentPushToken[teacher]"
    assert pushes[0]["title"] == "New connection request"
    assert pushes[0]["data"] == {"tab": "connections"}


def test_connection_acceptance_pushes_to_requester(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    _register_push_token(client, student_token, "ExponentPushToken[student]")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    request_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
    )
    assert request_response.status_code == 201
    connection_id = request_response.json()["id"]
    captured_pushes.clear()

    accept_response = client.patch(
        f"/api/v1/network/connections/{connection_id}",
        headers=_auth_headers(teacher_token),
        json={"status": "accepted"},
    )

    assert accept_response.status_code == 200
    pushes = _all_pushes(captured_pushes)
    assert len(pushes) == 1
    assert pushes[0]["to"] == "ExponentPushToken[student]"
    assert pushes[0]["title"] == "Connection accepted"
    assert pushes[0]["data"] == {"tab": "connections"}


def test_declined_connection_sends_no_push(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    member_token = _login(client, "member")
    teacher_token = _login(client, "teacher")
    _register_push_token(client, member_token, "ExponentPushToken[member]")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    request_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(member_token),
    )
    assert request_response.status_code == 201
    connection_id = request_response.json()["id"]
    captured_pushes.clear()

    decline_response = client.patch(
        f"/api/v1/network/connections/{connection_id}",
        headers=_auth_headers(teacher_token),
        json={"status": "declined"},
    )

    assert decline_response.status_code == 200
    assert captured_pushes == []


def test_application_decisions_push_to_applicant(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    employer_token = _login_with(client, **EMPLOYER_CREDENTIALS)
    _register_push_token(client, student_token, "ExponentPushToken[student]")
    opportunity_id = _opportunity_id_by_type(testing_session_local, "internship")

    apply_response = client.post(
        f"/api/v1/network/opportunities/{opportunity_id}/apply",
        headers=_auth_headers(student_token),
    )
    assert apply_response.status_code == 201
    application_id = apply_response.json()["id"]

    reviewing_response = client.patch(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(employer_token),
        json={"status": "reviewing"},
    )
    assert reviewing_response.status_code == 200
    assert captured_pushes == []

    accepted_response = client.patch(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(employer_token),
        json={"status": "accepted"},
    )

    assert accepted_response.status_code == 200
    pushes = _all_pushes(captured_pushes)
    assert len(pushes) == 1
    assert pushes[0]["to"] == "ExponentPushToken[student]"
    assert pushes[0]["title"] == "Application update"
    assert "accepted" in pushes[0]["body"]
    assert pushes[0]["data"] == {"tab": "applications"}


def test_application_rejection_pushes_to_applicant(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    member_token = _login(client, "member")
    employer_token = _login_with(client, **EMPLOYER_CREDENTIALS)
    _register_push_token(client, member_token, "ExponentPushToken[member]")
    opportunity_id = _opportunity_id_by_type(testing_session_local, "internship")

    apply_response = client.post(
        f"/api/v1/network/opportunities/{opportunity_id}/apply",
        headers=_auth_headers(member_token),
    )
    assert apply_response.status_code == 201
    application_id = apply_response.json()["id"]

    rejected_response = client.patch(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(employer_token),
        json={"status": "rejected"},
    )

    assert rejected_response.status_code == 200
    pushes = _all_pushes(captured_pushes)
    assert len(pushes) == 1
    assert pushes[0]["to"] == "ExponentPushToken[member]"
    assert "rejected" in pushes[0]["body"]


def test_push_failure_does_not_fail_triggering_request(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    _register_push_token(client, teacher_token, "ExponentPushToken[teacher]")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    def failing_post(messages: list[dict[str, Any]]) -> dict[str, Any]:
        raise RuntimeError("Expo Push API unreachable")

    monkeypatch.setattr(push_service, "_post_expo_push", failing_post)

    response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
    )

    assert response.status_code == 201


def test_device_not_registered_ticket_prunes_token(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    monkeypatch.setattr(push_service, "SessionLocal", testing_session_local)

    def dead_device_post(messages: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "data": [
                {
                    "status": "error",
                    "message": "device is not registered",
                    "details": {"error": "DeviceNotRegistered"},
                }
                for _ in messages
            ]
        }

    monkeypatch.setattr(push_service, "_post_expo_push", dead_device_post)

    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    _register_push_token(client, teacher_token, "ExponentPushToken[gone]")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
    )
    assert response.status_code == 201

    with testing_session_local() as db:
        remaining = db.scalar(
            select(PushToken).where(PushToken.token == "ExponentPushToken[gone]")
        )
    assert remaining is None


def test_pushes_default_to_azerbaijani_without_a_language(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    # Older app builds register without a language.
    _register_push_token(client, teacher_token, "ExponentPushToken[teacher]", language=None)
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
    )

    assert response.status_code == 201
    pushes = _all_pushes(captured_pushes)
    assert pushes[0]["title"] == "Yeni əlaqə sorğusu"
    assert pushes[0]["body"].endswith("sizinlə əlaqə qurmaq istəyir.")


def test_each_device_gets_its_own_language_and_switching_updates_it(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    _register_push_token(client, teacher_token, "ExponentPushToken[phone]", language="ru")
    _register_push_token(client, teacher_token, "ExponentPushToken[tablet]", language="az")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
    )
    titles = {push["to"]: push["title"] for push in _all_pushes(captured_pushes)}
    assert titles == {
        "ExponentPushToken[phone]": "Новый запрос на контакт",
        "ExponentPushToken[tablet]": "Yeni əlaqə sorğusu",
    }

    # The app re-registers when the user switches language.
    registered = _register_push_token(client, teacher_token, "ExponentPushToken[phone]", language="en")
    assert registered["language"] == "en"


def test_message_push_uses_the_recipient_language(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    from app.services.push_messages import render_push

    title, body = render_push("message", "az", {"name": "Aydın", "preview": "Salam!"})
    assert (title, body) == ("Aydın sizə yazdı", "Salam!")
    title, _ = render_push("message", "ru", {"name": "Aydın", "preview": "Salam!"})
    assert title == "Сообщение от Aydın"
    # Unknown or missing language falls back to Azerbaijani.
    assert render_push("application_accepted", None, {"title": "X"})[0] == "Müraciət yeniliyi"


def _make_admin_with_device(
    testing_session_local: sessionmaker[Session], push_token: str, language: str | None = "en"
) -> None:
    from app.core.security import hash_password
    from app.models.push_token import PushToken
    from app.models.user import User

    with testing_session_local() as db:
        admin = User(
            email="moderator@example.edu",
            hashed_password=hash_password("moderator-password"),
            full_name="Moderator",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.flush()
        db.add(PushToken(user_id=admin.id, token=push_token, platform="ios", language=language))
        db.commit()


def test_new_report_alerts_admins_without_naming_the_reporter(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    _make_admin_with_device(testing_session_local, "ExponentPushToken[admin]")
    member_token = _login(client, "member")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    response = client.post(
        "/api/v1/network/reports",
        headers=_auth_headers(member_token),
        json={"target_type": "profile", "target_id": teacher_profile_id, "reason": "Spam"},
    )

    assert response.status_code == 201
    pushes = _all_pushes(captured_pushes)
    assert len(pushes) == 1
    assert pushes[0]["to"] == "ExponentPushToken[admin]"
    assert pushes[0]["title"] == "New report to review"
    assert pushes[0]["body"].startswith("Profile reported: ")
    assert pushes[0]["data"] == {"tab": "profile"}
    # The reporter's identity never appears in the alert.
    with testing_session_local() as db:
        from app.models.user import User

        member_name = db.scalar(
            select(User.full_name).where(User.email == DEV_CREDENTIALS["member"]["email"])
        )
    assert member_name not in pushes[0]["body"]


def test_report_alert_email_is_sent_when_configured(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.email_alerts as email_alerts
    from app.core.config import Settings

    sent: list[Any] = []

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: float) -> None:
            sent.append(("connect", host, port))

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, *args: Any) -> None:
            return None

        def starttls(self) -> None:
            sent.append(("starttls",))

        def login(self, username: str, password: str) -> None:
            sent.append(("login", username))

        def send_message(self, message: Any) -> None:
            sent.append(("send", message["To"], message["Subject"], message.get_content()))

    monkeypatch.setattr(
        email_alerts,
        "get_settings",
        lambda: Settings(
            moderation_alert_email="owner@example.com",
            smtp_host="smtp.example.com",
            smtp_username="owner@example.com",
            smtp_password="app-password",
            smtp_from="owner@example.com",
        ),
    )
    monkeypatch.setattr(email_alerts.smtplib, "SMTP", FakeSMTP)

    client, testing_session_local = seeded_client_and_sessionmaker
    member_token = _login(client, "member")
    opportunity_id = _opportunity_id_by_type(testing_session_local, "research")
    response = client.post(
        "/api/v1/network/reports",
        headers=_auth_headers(member_token),
        json={"target_type": "opportunity", "target_id": opportunity_id, "reason": "Scam"},
    )

    assert response.status_code == 201
    assert ("connect", "smtp.example.com", 587) in sent
    assert ("login", "owner@example.com") in sent
    message = next(item for item in sent if item[0] == "send")
    assert message[1] == "owner@example.com"
    assert "New report" in message[2]
    assert "Reason: Scam" in message[3]
    assert "within 8 hours" in message[3]


def test_report_alert_email_is_skipped_when_not_configured(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.email_alerts as email_alerts

    def fail(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("SMTP must not be used without configuration")

    monkeypatch.setattr(email_alerts.smtplib, "SMTP", fail)
    client, testing_session_local = seeded_client_and_sessionmaker
    member_token = _login(client, "member")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )
    response = client.post(
        "/api/v1/network/reports",
        headers=_auth_headers(member_token),
        json={"target_type": "profile", "target_id": teacher_profile_id},
    )
    assert response.status_code == 201
