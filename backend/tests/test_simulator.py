from fastapi.testclient import TestClient

from app.main import app

EXAMPLE_DECISIONS = [
    {"initiative_id": "M7", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M8", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M10", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M12", "scope": "city", "district_id": None},
    {"initiative_id": "M5", "scope": "district", "district_id": "saryarka"},
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

    contributions = {
        item["initiative_id"]: item for item in result["initiative_contributions"]
    }
    assert contributions["M7"]["district_ids"] == ["nura"]
    assert set(contributions["M12"]["district_ids"]) == {
        "yesil",
        "almaty",
        "saryarka",
        "baikonur",
        "nura",
    }


def test_over_budget_scenario_has_no_score() -> None:
    decisions = [
        {"initiative_id": "M3", "scope": "district", "district_id": "yesil"},
        {"initiative_id": "M2", "scope": "city", "district_id": None},
        {"initiative_id": "M5", "scope": "district", "district_id": "saryarka"},
        {"initiative_id": "M7", "scope": "district", "district_id": "nura"},
        {"initiative_id": "M13", "scope": "district", "district_id": "almaty"},
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
        {"initiative_id": "M4", "scope": "district", "district_id": "nura"},
        {"initiative_id": "M7", "scope": "district", "district_id": "nura"},
        {"initiative_id": "M12", "scope": "city", "district_id": "yesil"},
        {"initiative_id": "M10", "scope": "city", "district_id": None},
        {"initiative_id": "M10", "scope": "district", "district_id": "yesil"},
    ]
    with TestClient(app) as client:
        response = client.post("/api/scenarios/validate", json={"decisions": decisions})

    assert response.status_code == 200
    codes = {item["code"] for item in response.json()["violations"]}
    assert {
        "INCOMPATIBLE_INITIATIVES",
        "DISTRICT_NOT_ALLOWED",
        "SCOPE_NOT_ALLOWED",
        "DUPLICATE_INITIATIVE",
    } <= codes


def test_district_scope_requires_one_known_district() -> None:
    missing_district = [*EXAMPLE_DECISIONS]
    missing_district[0] = {"initiative_id": "M7", "scope": "district"}
    unknown_district = [*EXAMPLE_DECISIONS]
    unknown_district[0] = {
        "initiative_id": "M7",
        "scope": "district",
        "district_id": "unknown",
    }

    with TestClient(app) as client:
        missing_response = client.post(
            "/api/scenarios/validate", json={"decisions": missing_district}
        )
        unknown_response = client.post(
            "/api/scenarios/validate", json={"decisions": unknown_district}
        )

    assert missing_response.status_code == 200
    assert "DISTRICT_REQUIRED" in {
        item["code"] for item in missing_response.json()["violations"]
    }
    assert unknown_response.status_code == 200
    assert "UNKNOWN_DISTRICT" in {
        item["code"] for item in unknown_response.json()["violations"]
    }


def test_request_schema_rejects_missing_or_unknown_scope() -> None:
    missing_scope = [dict(item) for item in EXAMPLE_DECISIONS]
    missing_scope[0].pop("scope")
    unknown_scope = [dict(item) for item in EXAMPLE_DECISIONS]
    unknown_scope[0]["scope"] = "region"

    with TestClient(app) as client:
        missing_response = client.post(
            "/api/scenarios/validate", json={"decisions": missing_scope}
        )
        unknown_response = client.post(
            "/api/scenarios/validate", json={"decisions": unknown_scope}
        )

    assert missing_response.status_code == 422
    assert unknown_response.status_code == 422


def test_reordering_decisions_preserves_deterministic_scores() -> None:
    with TestClient(app) as client:
        original = client.post(
            "/api/scenarios/simulate", json={"decisions": EXAMPLE_DECISIONS}
        )
        reordered = client.post(
            "/api/scenarios/simulate", json={"decisions": list(reversed(EXAMPLE_DECISIONS))}
        )

    assert original.status_code == 200
    assert reordered.status_code == 200
    assert reordered.json()["final_score"] == original.json()["final_score"]
    assert reordered.json()["district_results"] == original.json()["district_results"]
