from fastapi.testclient import TestClient

from app.main import app

EXAMPLE_DECISIONS = [
    {"initiative_id": "M7", "district_id": "nura"},
    {"initiative_id": "M8", "district_id": "nura"},
    {"initiative_id": "M10", "district_id": "nura"},
    {"initiative_id": "M12", "district_id": None},
    {"initiative_id": "M5", "district_id": "saryarka"},
]


def test_catalog_exposes_authoritative_parameters() -> None:
    with TestClient(app) as client:
        response = client.get("/api/simulator")

    assert response.status_code == 200
    body = response.json()
    assert body["data_mode"] == "SAMPLE"
    assert body["budget"] == 100
    assert body["required_decisions"] == 5
    assert len(body["districts"]) == 5
    assert len(body["indicators"]) == 10
    assert len(body["initiatives"]) == 14
    assert abs(body["baseline_score"] - 52.56) <= 0.01


def test_published_example_is_valid_and_changes_score() -> None:
    with TestClient(app) as client:
        validation = client.post(
            "/api/scenarios/validate", json={"decisions": EXAMPLE_DECISIONS}
        )
        simulation = client.post(
            "/api/scenarios/simulate", json={"decisions": EXAMPLE_DECISIONS}
        )

    assert validation.status_code == 200
    assert validation.json() == {
        "valid": True,
        "total_cost": 95,
        "remaining_budget": 5,
        "decision_count": 5,
        "violations": [],
    }
    assert simulation.status_code == 200
    result = simulation.json()
    assert abs(result["baseline_score"] - 52.56) <= 0.01
    assert abs(result["final_score"] - 56.5) <= 0.05
    assert result["score_delta"] > 0
    assert result["activated_synergies"] == ["M10+M12"]
    assert result["ai_provider"] == "mock"


def test_over_budget_scenario_has_no_score() -> None:
    decisions = [
        {"initiative_id": "M3", "district_id": "yesil"},
        {"initiative_id": "M2", "district_id": None},
        {"initiative_id": "M5", "district_id": "saryarka"},
        {"initiative_id": "M7", "district_id": "nura"},
        {"initiative_id": "M13", "district_id": "almaty"},
    ]
    with TestClient(app) as client:
        response = client.post("/api/scenarios/simulate", json={"decisions": decisions})

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["valid"] is False
    assert detail["total_cost"] == 129
    assert "BUDGET_EXCEEDED" in {item["code"] for item in detail["violations"]}
    assert "final_score" not in detail


def test_scope_duplicate_and_incompatibility_rules_are_reported() -> None:
    decisions = [
        {"initiative_id": "M4", "district_id": "nura"},
        {"initiative_id": "M7", "district_id": "nura"},
        {"initiative_id": "M12", "district_id": "yesil"},
        {"initiative_id": "M10", "district_id": None},
        {"initiative_id": "M10", "district_id": "yesil"},
    ]
    with TestClient(app) as client:
        response = client.post("/api/scenarios/validate", json={"decisions": decisions})

    assert response.status_code == 200
    codes = {item["code"] for item in response.json()["violations"]}
    assert {
        "INCOMPATIBLE_INITIATIVES",
        "DISTRICT_NOT_ALLOWED",
        "DISTRICT_REQUIRED",
        "DUPLICATE_INITIATIVE",
    } <= codes
