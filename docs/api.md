# API contract — MeysQosAI v1

Development base URL: `http://localhost:8000`. All simulator data is synthetic and responses include `data_mode: "SAMPLE"`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Process health and configured AI mode |
| GET | `/api/simulator` | Shared budget, baseline, indicators, initiatives, and rules |
| POST | `/api/scenarios/validate` | Validate a draft and return cost plus actionable violations |
| POST | `/api/scenarios/simulate` | Validate, calculate, explain, and optionally persist one scenario |

The first implementation slice may combine live client-side hints with server validation, but the server remains authoritative.

## Shared request model

```json
{
  "decisions": [
    {"initiative_id": "M7", "district_id": "nura"},
    {"initiative_id": "M8", "district_id": "nura"},
    {"initiative_id": "M10", "district_id": "nura"},
    {"initiative_id": "M12", "district_id": null},
    {"initiative_id": "M5", "district_id": "saryarka"}
  ]
}
```

Rules:

- `decisions` contains exactly five unique initiative IDs for simulation; validation may accept a partial draft.
- `district_id` is required for district-scoped initiatives and must be `null` or omitted for city-scoped initiatives.
- Unknown fields and IDs are rejected rather than silently ignored.
- Decision order has no effect.

## GET `/api/simulator`

Returns the complete immutable input required to build the scenario UI:

```json
{
  "data_mode": "SAMPLE",
  "dataset_version": "2026-09-23",
  "budget": 100,
  "required_decisions": 5,
  "horizon_quarters": 8,
  "baseline_score": 52.56,
  "directions": [],
  "indicators": [],
  "districts": [],
  "initiatives": [],
  "synergies": [],
  "incompatibilities": []
}
```

The arrays contain the exact organizer-provided fixture fields. This endpoint is the frontend's catalog source; the UI does not hard-code costs or effects.

## POST `/api/scenarios/validate`

Partial drafts return HTTP 200 with validation state:

```json
{
  "valid": false,
  "total_cost": 108,
  "remaining_budget": -8,
  "decision_count": 5,
  "violations": [
    {
      "code": "BUDGET_EXCEEDED",
      "message": "Scenario costs 108; budget is 100.",
      "decision_indexes": []
    }
  ]
}
```

Stable violation codes for v1:

- `WRONG_DECISION_COUNT`
- `DUPLICATE_INITIATIVE`
- `UNKNOWN_INITIATIVE`
- `DISTRICT_REQUIRED`
- `DISTRICT_NOT_ALLOWED`
- `UNKNOWN_DISTRICT`
- `BUDGET_EXCEEDED`
- `DIRECTION_LIMIT_EXCEEDED`
- `INCOMPATIBLE_INITIATIVES`

## POST `/api/scenarios/simulate`

Invalid scenarios return HTTP 422 with the same validation object under `detail`. Valid scenarios return:

```json
{
  "scenario_id": 1,
  "data_mode": "SAMPLE",
  "dataset_version": "2026-09-23",
  "total_cost": 95,
  "remaining_budget": 5,
  "baseline_score": 52.56,
  "final_score": 56.5,
  "score_delta": 3.94,
  "critical_count": 0,
  "district_results": [],
  "indicator_deltas": [],
  "initiative_contributions": [],
  "activated_synergies": ["M10+M12"],
  "explanation": {
    "summary": "...",
    "strengths": ["..."],
    "risks": ["..."],
    "recommendations": ["..."]
  },
  "ai_provider": "mock"
}
```

`district_results` includes before/after district scores and each indicator value. `indicator_deltas` and `initiative_contributions` make the explanation auditable. Numeric fields come only from deterministic code.

## Error behavior

- Request/schema errors use FastAPI's 422 response.
- A well-formed but rule-invalid simulation uses 422 with stable violation codes.
- Missing or invalid fixture data returns 503 and no partial score.
- AI failure does not fail the simulation; the response uses the mock explanation and reports `ai_provider: "mock-fallback"`.
- Errors never expose secrets, filesystem paths, or provider payloads.

## First-slice acceptance contract

1. `GET /api/simulator` exposes budget 100, five districts, 10 indicators, and 14 initiatives.
2. The fixture baseline calculates to 52.56 within ±0.01.
3. The supplied five-decision example validates at cost 95 and calculates to approximately 56.5.
4. An over-budget, duplicate, wrong-scope, or incompatible scenario returns an actionable violation and no score.
5. Simulation succeeds with `AI_PROVIDER=mock` and with no network credentials.
