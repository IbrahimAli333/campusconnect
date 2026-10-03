"""Isolated deletion-test engines; never use the application's configured DB."""
from contextlib import contextmanager
import os
from uuid import uuid4

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import StaticPool


@contextmanager
def deletion_test_engine():
    supplied = os.environ.get("UNIBRIDGE_DELETION_TEST_POSTGRES_URL")
    schema = None
    if supplied:
        url = make_url(supplied)
        if (url.drivername != "postgresql+psycopg" or url.host != "127.0.0.1"
                or url.database != "deletion_fixture" or url.username != "fixture"):
            raise ValueError("PostgreSQL tests require the dedicated local deletion_fixture database.")
        schema = "deletion_test_" + uuid4().hex
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
        with engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            assert connection.scalar(text("SHOW session_replication_role")) == "origin"
    else:
        engine = create_engine("sqlite+pysqlite://", poolclass=StaticPool,
                               connect_args={"check_same_thread": False})
        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _record):
            connection.execute("PRAGMA foreign_keys=ON")
    try:
        yield engine
    finally:
        if schema:
            # The generated schema belongs only to this fixture, including on failure.
            with engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()


def assert_foreign_keys(db):
    if db.bind.dialect.name == "sqlite":
        assert db.scalar(text("PRAGMA foreign_keys")) == 1
        assert db.execute(text("PRAGMA foreign_key_check")).all() == []
    else:
        assert db.scalar(text("SHOW session_replication_role")) == "origin"
