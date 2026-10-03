"""Bounded concurrency checks against the dedicated local PostgreSQL fixture."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import os
import time

import pytest
from sqlalchemy import event, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.models.announcement import Announcement
from app.models.material import Material
from app.models.push_token import PushToken
from app.models.user import User
from app.services.account_deletion import delete_user_account
from test_account_deletion_cleanup import cleanup_db, content_fixture  # noqa: F401

pytestmark = pytest.mark.skipif(
    not os.environ.get("UNIBRIDGE_DELETION_TEST_POSTGRES_URL"),
    reason="Requires the dedicated local PostgreSQL fixture",
)


@pytest.mark.parametrize("kind", ["announcement", "material"])
@pytest.mark.parametrize("operation", ["insert", "reassign"])
def test_concurrent_authored_write_cannot_survive_parent_deletion(cleanup_db, kind, operation):
    engine = cleanup_db.kw["bind"]
    if engine.dialect.name != "postgresql":
        pytest.skip("Requires PostgreSQL row locks and foreign-key enforcement")
    with cleanup_db() as db:
        ids = content_fixture(db)
        owner = db.get(User, ids["owner"])
        teacher_id = owner.teacher_profile.id
        other_teacher_id = db.get(User, ids["other"]).teacher_profile.id
        university_id = db.get(Announcement, ids["announcement"]).university_id

    snapshot_reached, release_delete, writer_started = Event(), Event(), Event()
    writer_pid = []

    def pause_after_material_snapshot(connection, _cursor, statement, *_args):
        sql = statement.lower()
        if (connection.info.get("deletion_regression") and not snapshot_reached.is_set()
                and sql.lstrip().startswith("select") and "from materials" in sql
                and "join teacher_profiles" in sql):
            snapshot_reached.set()
            assert release_delete.wait(10), "Deletion synchronization timed out"

    def delete_account():
        with cleanup_db() as db, db.begin():
            connection = db.connection()
            connection.info["deletion_regression"] = True
            try:
                db.execute(text("SET LOCAL statement_timeout = '8000ms'"))
                delete_user_account(db, db.get(User, ids["owner"]))
            finally:
                connection.info.pop("deletion_regression", None)

    def write_content():
        try:
            with cleanup_db() as db, db.begin():
                db.execute(text("SET LOCAL statement_timeout = '8000ms'"))
                writer_pid.append(db.scalar(text("SELECT pg_backend_pid()")))
                if operation == "reassign":
                    if kind == "announcement":
                        record = db.get(Announcement, ids["announcement"])
                        assert record is not None
                        record.published_by_user_id = ids["other"]
                    else:
                        record = db.get(Material, ids["material"])
                        assert record is not None
                        record.published_by_teacher_id = other_teacher_id
                elif kind == "announcement":
                    record = Announcement(
                        university_id=university_id, published_by_user_id=ids["owner"],
                        title="Concurrent synthetic announcement", body="Fixture only", target_role="all",
                    )
                else:
                    record = Material(
                        course_id=ids["course"], published_by_teacher_id=teacher_id,
                        title="Concurrent synthetic material", kind="link", url="https://example.invalid/concurrent",
                    )
                db.add(record)
                writer_started.set()
                db.flush()
            return "committed"
        except IntegrityError as error:
            assert operation == "insert"
            assert error.orig.sqlstate == "23503", "Expected a foreign-key rejection"
            return "foreign_key_rejected"
        except StaleDataError:
            assert operation == "reassign"
            return "row_already_deleted"

    event.listen(engine, "after_cursor_execute", pause_after_material_snapshot)
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            deleting = executor.submit(delete_account)
            try:
                assert snapshot_reached.wait(5), "Deletion did not reach authored-content snapshot"
                writing = executor.submit(write_content)
                assert writer_started.wait(5), "Concurrent writer did not start"
                deadline = time.monotonic() + 5
                blocked_on_lock = False
                while time.monotonic() < deadline and not writing.done():
                    with engine.connect() as observer:
                        blocked_on_lock = observer.scalar(text(
                            "SELECT wait_event_type = 'Lock' FROM pg_stat_activity WHERE pid = :pid"
                        ), {"pid": writer_pid[0]})
                    if blocked_on_lock:
                        break
                    time.sleep(0.01)
                assert blocked_on_lock, "Authored write was not held behind the deletion locks"
            finally:
                release_delete.set()
            deleting.result(timeout=10)
            expected = "foreign_key_rejected" if operation == "insert" else "row_already_deleted"
            assert writing.result(timeout=10) == expected
    finally:
        release_delete.set()
        event.remove(engine, "after_cursor_execute", pause_after_material_snapshot)

    with cleanup_db() as db:
        assert db.get(User, ids["owner"]) is None
        assert db.get(Announcement, ids["announcement"]) is None
        assert db.get(Material, ids["material"]) is None
        assert db.scalar(select(Announcement.id).where(
            Announcement.title == "Concurrent synthetic announcement"
        )) is None
        assert db.scalar(select(Material.id).where(
            Material.title == "Concurrent synthetic material"
        )) is None
        assert db.get(User, ids["other"]) is not None


def test_preloaded_collections_do_not_delete_reassigned_content(cleanup_db):
    if cleanup_db.kw["bind"].dialect.name != "postgresql":
        pytest.skip("Requires independent PostgreSQL transactions")
    with cleanup_db() as initial:
        ids = content_fixture(initial)
        token = PushToken(user_id=ids["owner"], token="synthetic-reassigned-device", platform="android")
        initial.add(token)
        initial.commit()
        token_id = token.id

    with cleanup_db() as deleting:
        owner = deleting.get(User, ids["owner"])
        list(owner.published_announcements)
        list(owner.teacher_profile.published_materials)
        list(owner.push_tokens)
        with cleanup_db() as updating, updating.begin():
            other_teacher_id = updating.get(User, ids["other"]).teacher_profile.id
            updating.get(Announcement, ids["announcement"]).published_by_user_id = ids["other"]
            updating.get(Material, ids["material"]).published_by_teacher_id = other_teacher_id
            updating.get(PushToken, token_id).user_id = ids["other"]
        delete_user_account(deleting, owner)
        deleting.commit()

    with cleanup_db() as db:
        assert db.get(User, ids["owner"]) is None
        assert db.get(Announcement, ids["announcement"]).published_by_user_id == ids["other"]
        assert db.get(Material, ids["material"]).published_by_teacher_id == other_teacher_id
        assert db.get(PushToken, token_id).user_id == ids["other"]
