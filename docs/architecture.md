# Architecture — MeysQosAI city simulator

## Golden Path

```text
Synthetic fixture (districts, indicators, initiatives, rules)
        ↓
React scenario builder → FastAPI validation/orchestration → deterministic simulator
        ↑                         ↓                         ↓
live budget/rule hints     structured result          SQLite scenarios
        ↑                         ↓
        └──────── score, deltas, risks, explanation ← AI adapter/mock fallback
```

The application remains one React frontend, one FastAPI backend, and one SQLite database. No microservices, queues, vector database, or separate model service are needed for the demo.

## Responsibility boundaries

- `frontend/`: scenario selection, budget display, client-side convenience hints, result visualization. It must not be the source of truth for validation or scoring.
- `backend/app/main.py`: HTTP contracts and orchestration.
- `backend/app/services/simulator.py`: deterministic validation and scoring; no network or LLM dependency.
- `backend/app/services/ai.py`: explains a structured simulation result; never generates numeric metrics.
- `backend/app/database.py`: optional persistence of submitted scenarios and results.
- `data/`: versioned synthetic fixture with visible `SAMPLE / DEMO DATA` metadata.
- `docs/api.md`: shared frontend/backend contract.

## Deterministic calculation

For each selected initiative, apply its full effect multiplied by `(8 - lag_quarters) / 8`. City initiatives affect all five districts; district initiatives affect only their selected district. Then apply fixed synergies and clip each indicator to 0–100.

District score:

```text
D_d = sum(indicator_value[d, k] * indicator_weight[k])
```

City score:

```text
D_avg = sum(population_share[d] * D_d)
Score = 0.7 * D_avg + 0.3 * min(D_d) - N_crit
```

`N_crit` is the number of district/indicator values strictly below 40 after effects. Store full precision internally and round only for display.

## Validation order

1. Request shape and known IDs.
2. Exactly five unique decisions.
3. Correct district target for each scope.
4. Total cost no greater than 100.
5. No more than two initiatives from one direction.
6. No incompatible pairs in the prohibited scope.
7. Deterministic calculation invariants and finite 0–100 outputs.

The backend returns all actionable violations together when possible. Invalid scenarios never receive a score.

## Minimal data model

The catalog and baseline are versioned JSON fixtures, not database rows. SQLite stores only user-created demo runs:

```text
scenario
  id, created_at, dataset_version, total_cost, baseline_score,
  final_score, score_delta, decisions_json, result_json, explanation
```

No personal data is stored. A reset may clear demo scenarios without affecting the versioned fixture.

## Reliability and AI behavior

- The simulator is pure and testable: identical fixture + decisions produce identical results.
- `AI_PROVIDER=mock` is the default and produces a useful structured explanation without credentials.
- A real provider receives only calculated deltas, risks, and initiative contributions—not raw secrets or personal data.
- Provider failure falls back to the mock explanation and is disclosed in the response metadata.
- The frontend can render a full numerical result without any AI response.

## Decision log

### 2026-09-23 — Keep the existing React/FastAPI/SQLite monolith

- **Reason:** it is already scaffolded, works offline, and is the shortest path to a two-minute demo.
- **Rejected:** reusing the AquaOpsAI planned Go/Python split; it has no runnable implementation and adds integration risk.
- **Rollback:** not required; all domain logic is isolated in a simulator service.

### 2026-09-23 — Deterministic engine owns every number

- **Reason:** the supplied dataset defines exact formulas and judges must see repeatable changes when decisions change.
- **Rejected:** asking an LLM to estimate scores or effects.
- **Rollback:** the AI layer can be removed without changing validation or scoring.

### 2026-09-23 — Defer map and leaderboard

- **Reason:** a district comparison chart/table proves impact faster and with less risk than GIS or team identity.
- **Rejected:** map-first and multi-team architecture during the first slice.
- **Rollback:** add visual geography or saved-scenario comparison after the Golden Path is verified.
