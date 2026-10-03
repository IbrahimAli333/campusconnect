from collections.abc import Iterator

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker
from deletion_test_database import deletion_test_engine

import app.models  # noqa: F401
from app.db.base import Base
from app.models.user import User
from app.models.user_profile import UserProfile
from app.scripts import delete_user_account as operator


@pytest.fixture()
def sessions() -> Iterator[sessionmaker[Session]]:
    with deletion_test_engine() as engine:
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine, autoflush=False)
        with factory.begin() as db:
            for user_id, email in [(101, "delete@example.invalid"), (102, "keep@example.invalid")]:
                user = User(id=user_id, email=email, full_name="Synthetic fixture", hashed_password="unused",
                            role="member", is_active=False)
                user.network_profile = UserProfile(role="member", visibility="private")
                db.add(user)
        yield factory


def args(**overrides):
    return {"user_id": 101, "email": "delete@example.invalid", **overrides}


def execution(**overrides):
    return args(execute=True, ownership_confirmed=True, request_reference="request-001",
                confirmation="DELETE USER 101", **overrides)


def exists(sessions, user_id=101):
    with sessions() as db:
        return db.get(User, user_id) is not None


def test_default_preview_is_read_only_and_does_not_disclose_email(sessions):
    result = operator.process_request(sessions, **args())
    assert result["status"] == "dry_run"
    assert result["direct_counts"]["network_profiles"] == 1
    assert "@" not in str(result)
    assert exists(sessions)


@pytest.mark.parametrize("overrides", [
    {"ownership_confirmed": False}, {"request_reference": None},
    {"request_reference": "private@example.invalid"}, {"request_reference": "line\nbreak"},
    {"confirmation": "yes"}, {"confirmation": "DELETE USER 102"},
])
def test_execution_requires_each_explicit_guard(sessions, overrides):
    values = execution(); values.update(overrides)
    with pytest.raises(operator.OperatorDeletionError):
        operator.process_request(sessions, **values)
    assert exists(sessions)
    assert exists(sessions, 102)


@pytest.mark.parametrize("user_id,email", [(101, "keep@example.invalid"), (999, "keep@example.invalid")])
def test_id_email_mismatch_never_deletes(sessions, user_id, email):
    values = execution(); values.update(user_id=user_id, email=email, confirmation=f"DELETE USER {user_id}")
    with pytest.raises(operator.OperatorDeletionError):
        operator.process_request(sessions, **values)
    assert exists(sessions) and exists(sessions, 102)


def test_inactive_verified_account_deletes_and_repeat_is_safe(sessions):
    result = operator.process_request(sessions, **execution())
    assert result["status"] == "deleted" and result["database_verified"]
    assert not exists(sessions) and exists(sessions, 102)
    assert operator.process_request(sessions, **execution())["status"] == "already_absent"
    with sessions() as db:
        assert db.scalar(select(UserProfile.id).where(UserProfile.user_id == 101)) is None


def test_reused_email_with_new_id_is_not_deleted(sessions):
    operator.process_request(sessions, **execution())
    with sessions.begin() as db:
        db.add(User(id=103, email="delete@example.invalid", full_name="Replacement fixture",
                    hashed_password="unused", role="member", is_active=True))
    with pytest.raises(operator.OperatorDeletionError):
        operator.process_request(sessions, **execution())
    assert exists(sessions, 103)


def test_service_failure_rolls_back_even_after_flush(sessions, monkeypatch):
    real_delete = operator.delete_user_account
    def fail(db, user):
        real_delete(db, user)
        raise RuntimeError("synthetic failure")
    monkeypatch.setattr(operator, "delete_user_account", fail)
    with pytest.raises(RuntimeError, match="synthetic failure"):
        operator.process_request(sessions, **execution())
    assert exists(sessions) and exists(sessions, 102)


def test_cli_dry_run_does_not_prompt(sessions, capsys):
    def forbidden(_):
        pytest.fail("Dry-run must not ask to execute")
    assert operator.main(["--user-id", "101", "--email", "delete@example.invalid"],
                         session_factory=sessions, prompt=forbidden) == 0
    assert exists(sessions)
    assert "delete@example.invalid" not in capsys.readouterr().out


@pytest.mark.parametrize("answer", ["yes", "DELETE USER 102"])
def test_cli_wrong_confirmation_cancels(sessions, answer):
    assert operator.main(["--user-id", "101", "--email", "delete@example.invalid", "--execute",
                          "--ownership-confirmed", "--request-reference", "req-1"],
                         session_factory=sessions, prompt=lambda _: answer) == 1
    assert exists(sessions)


def test_cli_refetches_identity_after_prompt(sessions):
    def change_email(_):
        with sessions.begin() as db:
            db.get(User, 101).email = "changed@example.invalid"
        return "DELETE USER 101"
    assert operator.main(["--user-id", "101", "--email", "delete@example.invalid", "--execute",
                          "--ownership-confirmed", "--request-reference", "req-1"],
                         session_factory=sessions, prompt=change_email) == 1
    assert exists(sessions)


def test_cli_exception_does_not_print_database_secrets(sessions, monkeypatch, capsys):
    def fail(*_args, **_kwargs):
        raise RuntimeError("secret database password or message body")
    monkeypatch.setattr(operator, "process_request", fail)
    assert operator.main(["--user-id", "101", "--email", "delete@example.invalid"],
                         session_factory=sessions) == 1
    assert "secret database" not in capsys.readouterr().err


def test_cli_initialization_failure_does_not_expose_settings(monkeypatch, capsys):
    import builtins
    real_import = builtins.__import__

    def fail_session_import(name, *args, **kwargs):
        if name == "app.db.session":
            raise RuntimeError("synthetic-secret-from-settings")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fail_session_import)
    assert operator.main(["--user-id", "101", "--email", "delete@example.invalid"]) == 1
    output = capsys.readouterr()
    assert "Database operation failed" in output.err
    assert "synthetic-secret" not in output.err + output.out
