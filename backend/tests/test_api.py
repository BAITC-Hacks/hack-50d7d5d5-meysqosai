import os
import tempfile

os.environ["DATA_PATH"] = tempfile.mktemp(suffix=".db")
os.environ["AI_PROVIDER"] = "mock"

from fastapi.testclient import TestClient

from app.database import replace_evidence
from app.main import app

EXAMPLE_DECISIONS = [
    {"initiative_id": "M7", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M8", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M10", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M12", "scope": "city", "district_id": None},
    {"initiative_id": "M5", "scope": "district", "district_id": "saryarka"},
]


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


def test_evidence_advice_uses_cached_sources_without_network() -> None:
    evidence = [
        {
            "title": "Официальная статистика транспорта Астаны",
            "url": "https://stat.gov.kz/example-astana-transport",
            "publisher": "Бюро национальной статистики",
            "published_at": "2026-01-10",
            "direction": "transport",
            "claim_type": "independent_statistic",
            "claim": "Опубликован измеримый показатель использования городского транспорта.",
            "confidence": "high",
            "limitations": ["Тестовая карточка API; не показывается в production seed."],
        },
        {
            "title": "Аудит цифровых городских проектов",
            "url": "https://rkastana.gov.kz/example-audit",
            "publisher": "Ревизионная комиссия по городу Астана",
            "published_at": "2026-02-12",
            "direction": "services",
            "claim_type": "audit_issue",
            "claim": "Аудит отметил риск контроля ожидаемых результатов цифрового проекта.",
            "confidence": "high",
            "limitations": ["Требуется сверка применимости к выбранной инициативе."],
        },
    ]
    with TestClient(app) as client:
        replace_evidence(os.environ["DATA_PATH"], evidence, "test-fixture")
        status = client.get("/api/evidence/status")
        response = client.post(
            "/api/scenarios/advise", json={"decisions": EXAMPLE_DECISIONS}
        )

    assert status.status_code == 200
    assert status.json()["item_count"] == 2
    assert response.status_code == 200
    body = response.json()
    assert body["data_mode"] == "MIXED"
    assert body["advice_provider"] == "mock"
    assert len(body["recommendations"]) == 5
    assert {item["initiative_id"] for item in body["recommendations"]} == {
        item["initiative_id"] for item in EXAMPLE_DECISIONS
    }
    assert any(
        source["url"].startswith("https://")
        for item in body["recommendations"]
        for source in item["evidence"]
    )
