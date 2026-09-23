# API contract — MeysQosAI v1

Development base URL: `http://localhost:8000`. All simulator data is synthetic and responses include `data_mode: "SAMPLE"`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Process health and configured AI mode |
| GET | `/api/simulator` | Shared budget, baseline, indicators, initiatives, and rules |
| POST | `/api/scenarios/validate` | Validate a draft and return cost plus actionable violations |
| POST | `/api/scenarios/simulate` | Validate, calculate, explain, and optionally persist one scenario |
| GET | `/api/evidence/status` | Current official-source cache state |
| GET | `/api/evidence` | Normalized official evidence cards |
| POST | `/api/evidence/refresh` | Refresh the cache through allowlisted OpenAI web search |
| POST | `/api/scenarios/advise` | Compare a valid scenario with cached official evidence |

The first implementation slice may combine live client-side hints with server validation, but the server remains authoritative.

## Shared request model

```json
{
  "decisions": [
    {"initiative_id": "M7", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M8", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M10", "scope": "district", "district_id": "nura"},
    {"initiative_id": "M12", "scope": "city", "district_id": null},
    {"initiative_id": "M5", "scope": "district", "district_id": "saryarka"}
  ]
}
```

Rules:

- `decisions` contains exactly five unique initiative IDs for simulation; validation may accept a partial draft.
- `scope` is required and must be either `city` or `district`.
- An initiative is eligible only for the `scope` declared on its catalog record.
- `district_id` is required when `scope` is `district` and must be `null` or omitted
  when `scope` is `city`.
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
  "city_context": {
    "mission_ru": "...",
    "interpretation": {},
    "resource_constraints": {},
    "baseline_snapshot": {}
  },
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
- `INVALID_SCOPE` (defensive service validation; unsupported API values fail schema validation)
- `SCOPE_NOT_ALLOWED`
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
  "scenario_id": null,
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
  "report_context": {
    "goal_status": {},
    "resource_use": {},
    "coverage": {},
    "selected_decisions": [
      {
        "initiative_id": "M7",
        "target_name_ru": "Нура",
        "realized_effects": [],
        "rationale_ru": "..."
      }
    ],
    "remaining_critical_indicators": [],
    "tradeoffs": []
  },
  "explanation": {
    "summary": "...",
    "verdict": "improved",
    "strengths": ["..."],
    "risks": ["..."],
    "tradeoffs": ["..."],
    "resource_assessment": "...",
    "recommendations": ["..."]
  },
  "ai_provider": "mock"
}
```

`district_results` includes before/after district scores and each indicator value. `indicator_deltas` and `initiative_contributions` make the explanation auditable. Numeric fields come only from deterministic code.

`city_context` explains the shared mission, thresholds, constraints, and calculated baseline state, including ranked `city_needs`, `city_strengths`, and all district summaries. `report_context` is the machine-auditable input to the explanation after recalculation. Its `selected_decisions` records explain each measure's modeled role, target, realized effects, and weakest related baseline need without claiming to know the user's private intent. `verdict` is one of `improved`, `mixed`, or `declined`; it is interpretation, not a new score.

`scenario_id` is `null` in the current backend slice. It becomes an integer when
scenario persistence is implemented; persistence is not required for scoring.

## Official evidence endpoints

`POST /api/scenarios/compare` accepts `scenarios`, exactly five objects using the
shared scenario request. All five are validated and recalculated server-side.
Invalid input returns 422. The response contains zero-based `winner_indexes`
(all ties included), `best_score`, `provider`, `conclusion`, `reasons`, and
`limitations`. The AI explains the deterministic ranking; provider failure returns
a disclosed Russian-language deterministic fallback. This summary appears before
the individual reports in the results dialog.

`POST /api/evidence/refresh` performs live research only when `AI_PROVIDER=openai` and a backend key is configured. It returns status metadata, never provider credentials or raw provider payloads:

```json
{
  "status": "ready",
  "provider": "openai-web-search",
  "item_count": 10,
  "error_code": null,
  "updated_at": "2026-09-23 12:00:00"
}
```

If live refresh fails while an older cache exists, status becomes `cached` and the old evidence remains usable. With no cache, refresh returns 503. `GET /api/evidence` returns cards with `title`, `url`, `publisher`, `published_at`, `direction`, `claim_type`, `claim`, `confidence`, `limitations`, and fetch time.

`POST /api/scenarios/advise` accepts the shared scenario request. It recalculates the scenario to prevent client-supplied score claims, retrieves evidence by chosen directions, and returns one recommendation per initiative:

```json
{
  "data_mode": "MIXED",
  "disclosure": "Баллы сценария синтетические; ...",
  "evidence_status": {"status": "ready", "item_count": 10},
  "advice_provider": "openai",
  "city_digest": {
    "proven_patterns": [],
    "caution_signals": [],
    "evidence_gaps": []
  },
  "recommendations": [
    {
      "initiative_id": "M7",
      "assessment": "promising_with_conditions",
      "confidence": "medium",
      "rationale": "...",
      "conditions": ["..."],
      "evidence": [{"title": "...", "url": "https://..."}]
    }
  ]
}
```

Without cached evidence the endpoint returns 409. AI failure falls back to deterministic evidence mapping with `advice_provider: "mock-fallback"`.

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
