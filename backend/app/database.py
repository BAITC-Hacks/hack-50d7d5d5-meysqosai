import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any


@contextmanager
def _connect(data_path: str) -> Iterator[sqlite3.Connection]:
    path = Path(data_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize(data_path: str) -> None:
    with _connect(data_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS evidence_claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                publisher TEXT NOT NULL,
                published_at TEXT NOT NULL,
                direction TEXT NOT NULL,
                claim_type TEXT NOT NULL,
                claim TEXT NOT NULL,
                confidence TEXT NOT NULL,
                limitations_json TEXT NOT NULL,
                fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(url, claim)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS evidence_syncs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL,
                provider TEXT NOT NULL,
                item_count INTEGER NOT NULL,
                error_code TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def replace_evidence(
    data_path: str, items: list[dict[str, Any]], provider: str
) -> list[dict[str, Any]]:
    with _connect(data_path) as connection:
        connection.execute("DELETE FROM evidence_claims")
        connection.executemany(
            """
            INSERT INTO evidence_claims (
                title, url, publisher, published_at, direction, claim_type,
                claim, confidence, limitations_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    item["title"],
                    item["url"],
                    item["publisher"],
                    item["published_at"],
                    item["direction"],
                    item["claim_type"],
                    item["claim"],
                    item["confidence"],
                    json.dumps(item["limitations"], ensure_ascii=False),
                )
                for item in items
            ],
        )
        connection.execute(
            """
            INSERT INTO evidence_syncs (status, provider, item_count)
            VALUES ('ready', ?, ?)
            """,
            (provider, len(items)),
        )
    return list_evidence(data_path)


def record_evidence_sync(
    data_path: str,
    status: str,
    provider: str,
    item_count: int,
    error_code: str | None = None,
) -> None:
    with _connect(data_path) as connection:
        connection.execute(
            """
            INSERT INTO evidence_syncs (status, provider, item_count, error_code)
            VALUES (?, ?, ?, ?)
            """,
            (status, provider, item_count, error_code),
        )


def list_evidence(data_path: str) -> list[dict[str, Any]]:
    with _connect(data_path) as connection:
        rows = connection.execute(
            """
            SELECT id, title, url, publisher, published_at, direction,
                   claim_type, claim, confidence, limitations_json, fetched_at
            FROM evidence_claims
            ORDER BY
                CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                published_at DESC,
                id ASC
            """
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["limitations"] = json.loads(item.pop("limitations_json"))
        result.append(item)
    return result


def evidence_status(data_path: str) -> dict[str, Any]:
    with _connect(data_path) as connection:
        count = connection.execute("SELECT COUNT(*) FROM evidence_claims").fetchone()[0]
        row = connection.execute(
            """
            SELECT status, provider, item_count, error_code, created_at
            FROM evidence_syncs
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()
    if row is None:
        return {
            "status": "empty",
            "provider": None,
            "item_count": count,
            "error_code": None,
            "updated_at": None,
        }
    return {
        "status": row["status"],
        "provider": row["provider"],
        "item_count": count,
        "error_code": row["error_code"],
        "updated_at": row["created_at"],
    }
