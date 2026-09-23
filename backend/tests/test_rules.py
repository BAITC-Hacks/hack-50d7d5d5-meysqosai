from copy import deepcopy
from itertools import permutations

import pytest

from app.services.simulator import (
    ScenarioValidationError,
    load_fixture,
    simulate,
    validate_scenario,
)


def decisions(ids):
    return [
        {"initiative_id": item, "scope": "city" if item == "M12" else "district",
         "district_id": None if item == "M12" else "nura"}
        for item in ids
    ]


def test_cheapest_example_and_all_orders():
    fixture = load_fixture("data/simulator.json")
    chosen = decisions(["M9", "M11", "M10", "M12", "M4"])
    result = simulate(fixture, chosen)
    assert result["total_cost"] == 61
    assert result["remaining_budget"] == 39
    for order in permutations(chosen):
        assert simulate(fixture, list(order))["final_score"] == result["final_score"]
    larger_budget = deepcopy(fixture)
    larger_budget["budget"] = 200
    assert simulate(larger_budget, chosen)["final_score"] == result["final_score"]
    exact_budget = deepcopy(fixture)
    exact_budget["budget"] = 61
    assert simulate(exact_budget, chosen)["final_score"] == result["final_score"]
    exact_budget["budget"] = 60
    assert not validate_scenario(exact_budget, chosen)["valid"]


@pytest.mark.parametrize("ids,code", [
    (["M9", "M11", "M10", "M12"], "WRONG_DECISION_COUNT"),
    (["M9", "M11", "M10", "M12", "M4", "M8"], "WRONG_DECISION_COUNT"),
    (["M9", "M9", "M10", "M12", "M4"], "DUPLICATE_INITIATIVE"),
    (["M7", "M8", "M9", "M10", "M12"], "DIRECTION_LIMIT_EXCEEDED"),
    (["M1", "M3", "M9", "M10", "M12"], "INCOMPATIBLE_INITIATIVES"),
    (["M4", "M7", "M9", "M10", "M12"], "INCOMPATIBLE_INITIATIVES"),
    (["M5", "M13", "M9", "M10", "M12"], "INCOMPATIBLE_INITIATIVES"),
])
def test_invalid_sets_have_reason_and_no_score(ids, code):
    fixture = load_fixture("data/simulator.json")
    chosen = decisions(ids)
    checked = validate_scenario(fixture, chosen)
    assert code in {item["code"] for item in checked["violations"]}
    with pytest.raises(ScenarioValidationError) as error:
        simulate(fixture, chosen)
    assert "final_score" not in error.value.validation


@pytest.mark.parametrize("pair", [("M4", "M7"), ("M5", "M13")])
def test_district_conflicts_allow_different_districts(pair):
    fixture = load_fixture("data/simulator.json")
    chosen = decisions([*pair, "M9", "M10", "M12"])
    chosen[0]["district_id"] = "saryarka"
    assert validate_scenario(fixture, chosen)["valid"]
