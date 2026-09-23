import os
import tempfile

os.environ["DATA_PATH"] = tempfile.mktemp(suffix=".db")
os.environ["AI_PROVIDER"] = "mock"

from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["ai_provider"] == "mock"


def test_note_round_trip() -> None:
    with TestClient(app) as client:
        created = client.post("/api/notes", json={"title": "Triage", "body": "Demo case"})
        listed = client.get("/api/notes")
    assert created.status_code == 201
    assert listed.json()[0]["title"] == "Triage"


def test_mock_summary_requires_no_key() -> None:
    with TestClient(app) as client:
        response = client.post("/api/ai/summarize", json={"text": "A public service update."})
    assert response.status_code == 200
    assert response.json()["provider"] == "mock"
