import sqlite3
from pathlib import Path


def _connect(data_path: str) -> sqlite3.Connection:
    path = Path(data_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize(data_path: str) -> None:
    with _connect(data_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def list_notes(data_path: str) -> list[dict[str, object]]:
    with _connect(data_path) as connection:
        rows = connection.execute(
            "SELECT id, title, body, created_at FROM notes ORDER BY id DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def create_note(data_path: str, title: str, body: str) -> dict[str, object]:
    with _connect(data_path) as connection:
        cursor = connection.execute(
            "INSERT INTO notes (title, body) VALUES (?, ?)",
            (title, body),
        )
        row = connection.execute(
            "SELECT id, title, body, created_at FROM notes WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    if row is None:
        raise RuntimeError("Created note could not be loaded")
    return dict(row)
