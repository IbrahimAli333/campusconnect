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
    return response.json()["access_token"]


def _login(client: TestClient, role: str) -> str:
    credentials = DEV_CREDENTIALS[role]
    return _login_with(client, credentials["email"], credentials["password"])


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


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


def _my_profile_id(client: TestClient, token: str) -> int:
    response = client.get("/api/v1/network/me", headers=_auth_headers(token))
    assert response.status_code == 200
    return response.json()["id"]


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


def _connect_accepted(
    client: TestClient,
    requester_token: str,
    receiver_token: str,
    receiver_profile_id: int,
) -> int:
    request_response = client.post(
        f"/api/v1/network/connections/{receiver_profile_id}/request",
        headers=_auth_headers(requester_token),
    )
    assert request_response.status_code == 201
    connection_id = request_response.json()["id"]
    accept_response = client.patch(
        f"/api/v1/network/connections/{connection_id}",
        headers=_auth_headers(receiver_token),
        json={"status": "accepted"},
    )
    assert accept_response.status_code == 200
    return connection_id


def _send_message(
    client: TestClient,
    token: str,
    profile_id: int,
    body: str,
) -> dict[str, Any]:
    response = client.post(
        f"/api/v1/network/messages/threads/{profile_id}",
        headers=_auth_headers(token),
        json={"body": body},
    )
    assert response.status_code == 201
    return response.json()


def test_messaging_rejected_without_accepted_relationship(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    send_response = client.post(
        f"/api/v1/network/messages/threads/{teacher_profile_id}",
        headers=_auth_headers(student_token),
        json={"body": "Hello"},
    )
    list_response = client.get(
        f"/api/v1/network/messages/threads/{teacher_profile_id}",
        headers=_auth_headers(student_token),
    )
    missing_response = client.get(
        "/api/v1/network/messages/threads/999999",
        headers=_auth_headers(student_token),
    )
    self_response = client.post(
        f"/api/v1/network/messages/threads/{_my_profile_id(client, student_token)}",
        headers=_auth_headers(student_token),
        json={"body": "Note to self"},
    )

    assert send_response.status_code == 403
    assert list_response.status_code == 403
    assert missing_response.status_code == 404
    assert self_response.status_code == 400


def test_pending_connection_does_not_allow_messaging(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )

    request_response = client.post(
        f"/api/v1/network/connections/{teacher_profile_id}/request",
        headers=_auth_headers(student_token),
    )
    assert request_response.status_code == 201

    send_response = client.post(
        f"/api/v1/network/messages/threads/{teacher_profile_id}",
        headers=_auth_headers(student_token),
        json={"body": "Hello"},
    )
    assert send_response.status_code == 403


def test_accepted_connection_can_exchange_messages(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    student_profile_id = _my_profile_id(client, student_token)
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )
    _connect_accepted(client, student_token, teacher_token, teacher_profile_id)

    sent = _send_message(client, student_token, teacher_profile_id, "Hello professor!")
    assert sent["sender_profile_id"] == student_profile_id
    assert sent["recipient_profile_id"] == teacher_profile_id
    assert sent["read_at"] is None

    unread_response = client.get(
        "/api/v1/network/messages/unread",
        headers=_auth_headers(teacher_token),
    )
    assert unread_response.status_code == 200
    assert unread_response.json() == {"unread": 1}

    threads_response = client.get(
        "/api/v1/network/messages/threads",
        headers=_auth_headers(teacher_token),
    )
    assert threads_response.status_code == 200
    threads = threads_response.json()
    assert len(threads) == 1
    assert threads[0]["profile"]["id"] == student_profile_id
    assert threads[0]["last_message"]["body"] == "Hello professor!"
    assert threads[0]["unread_count"] == 1

    # Reading the thread marks the messages read and clears the unread count.
    messages_response = client.get(
        f"/api/v1/network/messages/threads/{student_profile_id}",
        headers=_auth_headers(teacher_token),
    )
    assert messages_response.status_code == 200
    assert [message["body"] for message in messages_response.json()] == [
        "Hello professor!"
    ]
    assert messages_response.json()[0]["read_at"] is not None

    unread_after_read = client.get(
        "/api/v1/network/messages/unread",
        headers=_auth_headers(teacher_token),
    )
    assert unread_after_read.json() == {"unread": 0}

    _send_message(client, teacher_token, student_profile_id, "Hello Aydin.")
    student_thread = client.get(
        f"/api/v1/network/messages/threads/{teacher_profile_id}",
        headers=_auth_headers(student_token),
    )
    assert student_thread.status_code == 200
    assert [message["body"] for message in student_thread.json()] == [
        "Hello Aydin.",
        "Hello professor!",
    ]


def test_thread_messages_are_paginated(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )
    _connect_accepted(client, student_token, teacher_token, teacher_profile_id)
    for index in range(3):
        _send_message(client, student_token, teacher_profile_id, f"Message {index}")

    first_page = client.get(
        f"/api/v1/network/messages/threads/{teacher_profile_id}",
        headers=_auth_headers(student_token),
        params={"limit": 2, "offset": 0},
    )
    second_page = client.get(
        f"/api/v1/network/messages/threads/{teacher_profile_id}",
        headers=_auth_headers(student_token),
        params={"limit": 2, "offset": 2},
    )

    assert first_page.status_code == 200
    assert [message["body"] for message in first_page.json()] == [
        "Message 2",
        "Message 1",
    ]
    assert second_page.status_code == 200
    assert [message["body"] for message in second_page.json()] == ["Message 0"]


def test_accepted_application_enables_messaging(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    employer_token = _login_with(client, **EMPLOYER_CREDENTIALS)
    employer_profile_id = _profile_id_for_email(
        testing_session_local, EMPLOYER_CREDENTIALS["email"]
    )
    opportunity_id = _opportunity_id_by_type(testing_session_local, "internship")

    apply_response = client.post(
        f"/api/v1/network/opportunities/{opportunity_id}/apply",
        headers=_auth_headers(student_token),
    )
    assert apply_response.status_code == 201
    application_id = apply_response.json()["id"]

    # A submitted-but-undecided application does not open a thread.
    blocked_response = client.post(
        f"/api/v1/network/messages/threads/{employer_profile_id}",
        headers=_auth_headers(student_token),
        json={"body": "Thanks for considering me!"},
    )
    assert blocked_response.status_code == 403

    accept_response = client.patch(
        f"/api/v1/network/applications/{application_id}",
        headers=_auth_headers(employer_token),
        json={"status": "accepted"},
    )
    assert accept_response.status_code == 200

    _send_message(
        client, student_token, employer_profile_id, "Thanks for accepting me!"
    )
    student_profile_id = _my_profile_id(client, student_token)
    _send_message(client, employer_token, student_profile_id, "Welcome aboard.")

    thread_response = client.get(
        f"/api/v1/network/messages/threads/{employer_profile_id}",
        headers=_auth_headers(student_token),
    )
    assert [message["body"] for message in thread_response.json()] == [
        "Welcome aboard.",
        "Thanks for accepting me!",
    ]


def test_new_message_pushes_to_recipient(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
    captured_pushes: list[list[dict[str, Any]]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )
    _connect_accepted(client, student_token, teacher_token, teacher_profile_id)

    register_response = client.post(
        "/api/v1/notifications/tokens",
        headers=_auth_headers(teacher_token),
        json={"token": "ExponentPushToken[teacher]", "platform": "ios"},
    )
    assert register_response.status_code == 201
    captured_pushes.clear()

    _send_message(client, student_token, teacher_profile_id, "Quick question")

    pushes = [message for batch in captured_pushes for message in batch]
    assert len(pushes) == 1
    assert pushes[0]["to"] == "ExponentPushToken[teacher]"
    assert pushes[0]["title"] == "Message from Aydin Mammadli"
    assert pushes[0]["body"] == "Quick question"
    assert pushes[0]["data"] == {"tab": "connections"}


def test_empty_message_body_is_rejected(
    seeded_client_and_sessionmaker: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, testing_session_local = seeded_client_and_sessionmaker
    student_token = _login(client, "student")
    teacher_token = _login(client, "teacher")
    teacher_profile_id = _profile_id_for_email(
        testing_session_local, DEV_CREDENTIALS["teacher"]["email"]
    )
    _connect_accepted(client, student_token, teacher_token, teacher_profile_id)

    response = client.post(
        f"/api/v1/network/messages/threads/{teacher_profile_id}",
        headers=_auth_headers(student_token),
        json={"body": ""},
    )
    assert response.status_code == 422
