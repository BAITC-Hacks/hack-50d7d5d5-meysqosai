import json
import math
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any


class FixtureError(ValueError):
    pass


class ScenarioValidationError(ValueError):
    def __init__(self, validation: dict[str, Any]) -> None:
        super().__init__("Scenario is invalid")
        self.validation = validation


@lru_cache(maxsize=4)
def load_fixture(path_value: str) -> dict[str, Any]:
    path = Path(path_value)
    try:
        fixture = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise FixtureError("Simulator fixture is unavailable") from error
    _validate_fixture(fixture)
    return fixture


def _validate_fixture(fixture: dict[str, Any]) -> None:
    try:
        indicators = fixture["indicators"]
        districts = fixture["districts"]
        initiatives = fixture["initiatives"]
        indicator_ids = {item["id"] for item in indicators}
        district_ids = {item["id"] for item in districts}
        initiative_ids = {item["id"] for item in initiatives}
        weights_total = sum(float(item["weight"]) for item in indicators)
        population_total = sum(float(item["population_share"]) for item in districts)
    except (KeyError, TypeError, ValueError) as error:
        raise FixtureError("Simulator fixture has an invalid shape") from error

    if len(indicator_ids) != 10 or len(district_ids) != 5 or len(initiative_ids) != 14:
        raise FixtureError("Simulator fixture has duplicate or missing catalog IDs")
    if not math.isclose(weights_total, 1.0, abs_tol=1e-9):
        raise FixtureError("Indicator weights must sum to 1")
    if not math.isclose(population_total, 1.0, abs_tol=1e-9):
        raise FixtureError("District population shares must sum to 1")
    for district in districts:
        values = district.get("indicators", {})
        if set(values) != indicator_ids:
            raise FixtureError("Every district must contain every indicator")
        if any(not 0 <= float(value) <= 100 for value in values.values()):
            raise FixtureError("District indicator values must be between 0 and 100")
    for initiative in initiatives:
        if set(initiative.get("effects", {})) - indicator_ids:
            raise FixtureError("Initiative references an unknown indicator")
        if initiative.get("scope") not in {"city", "district"}:
            raise FixtureError("Initiative scope must be city or district")


def catalog(fixture: dict[str, Any]) -> dict[str, Any]:
    response = deepcopy(fixture)
    response["baseline_score"] = _score_state(fixture, _baseline_state(fixture))["score"]
    return response


def validate_scenario(
    fixture: dict[str, Any], decisions: list[dict[str, str | None]]
) -> dict[str, Any]:
    initiatives = {item["id"]: item for item in fixture["initiatives"]}
    district_ids = {item["id"] for item in fixture["districts"]}
    violations: list[dict[str, Any]] = []
    known: list[tuple[int, dict[str, str | None], dict[str, Any]]] = []
    initiative_indexes: dict[str, list[int]] = {}

    def add(code: str, message: str, indexes: list[int] | None = None) -> None:
        violations.append(
            {"code": code, "message": message, "decision_indexes": indexes or []}
        )

    if len(decisions) != fixture["required_decisions"]:
        add(
            "WRONG_DECISION_COUNT",
            f"Choose exactly {fixture['required_decisions']} decisions; received {len(decisions)}.",
            list(range(len(decisions))),
        )

    for index, decision in enumerate(decisions):
        initiative_id = decision["initiative_id"]
        initiative = initiatives.get(initiative_id)
        if initiative is None:
            add("UNKNOWN_INITIATIVE", f"Unknown initiative: {initiative_id}.", [index])
            continue
        known.append((index, decision, initiative))
        initiative_indexes.setdefault(initiative_id, []).append(index)
        scope = decision.get("scope")
        district_id = decision.get("district_id")
        if scope not in {"city", "district"}:
            add(
                "INVALID_SCOPE",
                f"Decision scope must be city or district; received {scope!r}.",
                [index],
            )
            continue
        if scope != initiative["scope"]:
            add(
                "SCOPE_NOT_ALLOWED",
                f"Initiative {initiative_id} supports {initiative['scope']} scope, not {scope}.",
                [index],
            )
        if scope == "district":
            if district_id is None:
                add(
                    "DISTRICT_REQUIRED",
                    f"Initiative {initiative_id} requires a district.",
                    [index],
                )
            elif district_id not in district_ids:
                add("UNKNOWN_DISTRICT", f"Unknown district: {district_id}.", [index])
        elif district_id is not None:
            add(
                "DISTRICT_NOT_ALLOWED",
                f"City-scoped decision {initiative_id} cannot target one district.",
                [index],
            )

    for initiative_id, indexes in initiative_indexes.items():
        if len(indexes) > 1:
            add(
                "DUPLICATE_INITIATIVE",
                f"Initiative {initiative_id} can be selected only once.",
                indexes,
            )

    total_cost = sum(int(initiative["cost"]) for _, _, initiative in known)
    if total_cost > fixture["budget"]:
        add(
            "BUDGET_EXCEEDED",
            f"Scenario costs {total_cost}; budget is {fixture['budget']}.",
        )

    direction_indexes: dict[str, list[int]] = {}
    for index, _, initiative in known:
        direction_indexes.setdefault(initiative["direction"], []).append(index)
    for direction, indexes in direction_indexes.items():
        if len(indexes) > fixture["max_per_direction"]:
            add(
                "DIRECTION_LIMIT_EXCEEDED",
                f"Direction {direction} has {len(indexes)} decisions; maximum is "
                f"{fixture['max_per_direction']}.",
                indexes,
            )

    first_decision = {decision["initiative_id"]: (index, decision) for index, decision, _ in known}
    for rule in fixture["incompatibilities"]:
        left_id, right_id = rule["initiative_ids"]
        if left_id not in first_decision or right_id not in first_decision:
            continue
        left_index, left = first_decision[left_id]
        right_index, right = first_decision[right_id]
        conflicts = rule["scope"] == "global" or (
            rule["scope"] == "same_district"
            and left.get("district_id") is not None
            and left.get("district_id") == right.get("district_id")
        )
        if conflicts:
            add(
                "INCOMPATIBLE_INITIATIVES",
                f"Initiatives {left_id} and {right_id} are incompatible for this scenario.",
                [left_index, right_index],
            )

    return {
        "valid": not violations,
        "total_cost": total_cost,
        "remaining_budget": fixture["budget"] - total_cost,
        "decision_count": len(decisions),
        "violations": violations,
    }


def simulate(
    fixture: dict[str, Any], decisions: list[dict[str, str | None]]
) -> dict[str, Any]:
    validation = validate_scenario(fixture, decisions)
    if not validation["valid"]:
        raise ScenarioValidationError(validation)

    initiatives = {item["id"]: item for item in fixture["initiatives"]}
    district_ids = [item["id"] for item in fixture["districts"]]
    state = _baseline_state(fixture)
    contributions: list[dict[str, Any]] = []
    selected = {decision["initiative_id"]: decision for decision in decisions}

    for decision in decisions:
        initiative = initiatives[decision["initiative_id"]]
        realized_fraction = (
            fixture["horizon_quarters"] - initiative["lag_quarters"]
        ) / fixture["horizon_quarters"]
        targets = district_ids if decision["scope"] == "city" else [decision["district_id"]]
        adjusted_effects = {
            indicator_id: effect * realized_fraction
            for indicator_id, effect in initiative["effects"].items()
        }
        for district_id in targets:
            for indicator_id, effect in adjusted_effects.items():
                state[district_id][indicator_id] += effect
        contributions.append(
            {
                "initiative_id": initiative["id"],
                "district_ids": targets,
                "realized_fraction": realized_fraction,
                "effects": adjusted_effects,
            }
        )

    activated_synergies: list[str] = []
    for synergy in fixture["synergies"]:
        if not all(initiative_id in selected for initiative_id in synergy["initiative_ids"]):
            continue
        target_decision = selected[synergy["target_from"]]
        targets = (
            district_ids
            if target_decision["scope"] == "city"
            else [target_decision["district_id"]]
        )
        for district_id in targets:
            for indicator_id, effect in synergy["effects"].items():
                state[district_id][indicator_id] += effect
        activated_synergies.append(synergy["id"])
        contributions.append(
            {
                "initiative_id": synergy["id"],
                "district_ids": targets,
                "realized_fraction": 1.0,
                "effects": synergy["effects"],
                "type": "synergy",
            }
        )

    for values in state.values():
        for indicator_id, value in values.items():
            values[indicator_id] = min(100.0, max(0.0, value))

    baseline_state = _baseline_state(fixture)
    baseline_scores = _score_state(fixture, baseline_state)
    final_scores = _score_state(fixture, state)
    district_results: list[dict[str, Any]] = []
    indicator_deltas: list[dict[str, Any]] = []

    for district in fixture["districts"]:
        district_id = district["id"]
        indicators: dict[str, dict[str, float]] = {}
        for indicator in fixture["indicators"]:
            indicator_id = indicator["id"]
            before = baseline_state[district_id][indicator_id]
            after = state[district_id][indicator_id]
            delta = after - before
            indicators[indicator_id] = {
                "before": before,
                "after": round(after, 4),
                "delta": round(delta, 4),
            }
            if not math.isclose(delta, 0.0, abs_tol=1e-12):
                indicator_deltas.append(
                    {
                        "district_id": district_id,
                        "indicator_id": indicator_id,
                        "before": before,
                        "after": round(after, 4),
                        "delta": round(delta, 4),
                    }
                )
        before_score = baseline_scores["district_scores"][district_id]
        after_score = final_scores["district_scores"][district_id]
        district_results.append(
            {
                "district_id": district_id,
                "name_ru": district["name_ru"],
                "before_score": round(before_score, 4),
                "after_score": round(after_score, 4),
                "score_delta": round(after_score - before_score, 4),
                "indicators": indicators,
            }
        )

    result = {
        "scenario_id": None,
        "data_mode": fixture["data_mode"],
        "dataset_version": fixture["dataset_version"],
        **validation,
        "baseline_score": baseline_scores["score"],
        "final_score": final_scores["score"],
        "score_delta": round(final_scores["score"] - baseline_scores["score"], 4),
        "critical_count": final_scores["critical_count"],
        "district_results": district_results,
        "indicator_deltas": indicator_deltas,
        "initiative_contributions": contributions,
        "activated_synergies": activated_synergies,
    }
    result["explanation"] = _mock_explanation(result)
    result["ai_provider"] = "mock"
    return result


def _baseline_state(fixture: dict[str, Any]) -> dict[str, dict[str, float]]:
    return {
        district["id"]: {
            indicator_id: float(value) for indicator_id, value in district["indicators"].items()
        }
        for district in fixture["districts"]
    }


def _score_state(fixture: dict[str, Any], state: dict[str, dict[str, float]]) -> dict[str, Any]:
    weights = {item["id"]: float(item["weight"]) for item in fixture["indicators"]}
    district_scores = {
        district_id: sum(values[indicator_id] * weights[indicator_id] for indicator_id in weights)
        for district_id, values in state.items()
    }
    population_shares = {
        item["id"]: float(item["population_share"]) for item in fixture["districts"]
    }
    average_score = sum(
        population_shares[district_id] * score for district_id, score in district_scores.items()
    )
    critical_count = sum(
        1 for values in state.values() for value in values.values() if value < 40
    )
    score = 0.7 * average_score + 0.3 * min(district_scores.values()) - critical_count
    return {
        "score": round(score, 4),
        "average_score": average_score,
        "critical_count": critical_count,
        "district_scores": district_scores,
    }


def _mock_explanation(result: dict[str, Any]) -> dict[str, Any]:
    ranked = sorted(
        result["district_results"], key=lambda district: district["score_delta"], reverse=True
    )
    strongest = ranked[0]
    weakest = min(result["district_results"], key=lambda district: district["after_score"])
    risks = [
        f"{result['critical_count']} district indicators remain below 40."
        if result["critical_count"]
        else "No district indicators remain below the critical threshold of 40.",
        (
            f"{weakest['name_ru']} remains the lowest-scoring district at "
            f"{weakest['after_score']:.2f}."
        ),
    ]
    return {
        "summary": f"Quality of Life Score changes by {result['score_delta']:+.2f} points.",
        "strengths": [
            f"{strongest['name_ru']} gains the most: {strongest['score_delta']:+.2f} points.",
            f"The scenario stays within budget with {result['remaining_budget']} units remaining.",
        ],
        "risks": risks,
        "recommendations": [
            "Compare the weakest district and remaining critical indicators before finalizing policy."
        ],
    }
