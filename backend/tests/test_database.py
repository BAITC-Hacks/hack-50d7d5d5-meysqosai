import sqlite3

import pytest

from app.database import _connect


def test_connection_commits_and_closes(tmp_path):
    path = str(tmp_path / "cache.db")
    with _connect(path) as connection:
        connection.execute("CREATE TABLE sample (value INTEGER)")
        connection.execute("INSERT INTO sample VALUES (1)")
    with pytest.raises(sqlite3.ProgrammingError):
        connection.execute("SELECT 1")
    with _connect(path) as reopened:
        assert reopened.execute("SELECT value FROM sample").fetchone()[0] == 1


def test_connection_rolls_back_and_closes_on_error(tmp_path):
    path = str(tmp_path / "cache.db")
    with _connect(path) as connection:
        connection.execute("CREATE TABLE sample (value INTEGER)")
    with pytest.raises(ValueError), _connect(path) as failed:
        failed.execute("INSERT INTO sample VALUES (1)")
        raise ValueError("rollback")
    with pytest.raises(sqlite3.ProgrammingError):
        failed.execute("SELECT 1")
    with _connect(path) as reopened:
        assert reopened.execute("SELECT COUNT(*) FROM sample").fetchone()[0] == 0
