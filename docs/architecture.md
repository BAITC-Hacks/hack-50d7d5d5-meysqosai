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

For each selected initiative, apply its full effect multiplied by `(8 - lag_quarters) / 8`.
Every decision explicitly declares `scope`. The catalog declares the one scope for which each
initiative is eligible: a valid `city` decision affects all five districts, while a valid
`district` decision affects only its one selected district. Then apply fixed synergies and clip
each indicator to 0–100.

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
3. Explicit scope is eligible for the initiative and has the correct district target.
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

### 2026-09-23 — Defer real GIS and leaderboard

- **Reason:** district indicators prove impact with less risk than real GIS or team identity.
- **Rejected:** geographic mapping dependencies and multi-team architecture during the first slice.
- **Rollback:** add sourced geography or saved-scenario comparison after the Golden Path is verified.

### 2026-09-23 — Replace the schematic map with sourced Astana geometry

- **Reason:** the AquaOps baseline supplied published district GeoJSON and a traceable Astana architecture GIS endpoint, allowing real spatial context without inventing boundaries.
- **Decision:** use Leaflet with OpenStreetMap tiles and bundle the district GeoJSON locally. Map `baikonyr` to the simulator's `baikonur` and `esil` to `yesil`; keep Saraishyk visible as a muted context-only district because the synthetic fixture models five districts.
- **Disclosure:** the interface always shows OSM attribution, the geometry source, and a warning that boundary currency has not been verified. The map is contextual, not an official cadastral or administrative product.
- **Resilience:** if OSM tiles fail, the locally bundled polygons and district selection remain available.
- **Rollback:** restore a non-geographic diagram if the geometry source or right to redistribute cannot be confirmed before submission.

### 2026-09-23 — Keep Leaflet/OSM instead of switching to 2GIS for presentation

- **Availability:** 2GIS MapGL JS is an active, documented WebGL map library with React support, GeoJSON sources, styling, and hover examples. It would support the district interaction technically.
- **Access and free tier:** MapGL initialization requires a 2GIS access key for Map Tiles API. The free option is a demo key valid for one month, currently limited to 500,000 Map Tiles requests; normal subscriptions are billed by tile request. The published entry package is currently 8,000 RUB per billing month for 100,000 Map Tiles units.
- **Attribution and licensing:** 2GIS documentation says its copyright control must always remain visible and unobstructed. Use is also governed by the 2GIS license and services agreements; map fragments require source attribution and an active 2GIS link.
- **Decision:** retain the existing Leaflet/OpenStreetMap implementation for the hackathon. It needs no new account, key, paid plan, provider SDK, or secret-handling path, and its locally bundled district polygons remain interactive if remote tiles fail. A basemap swap would not improve the simulator's core decision flow enough to justify those demo-day dependencies.
- **Revisit when:** the project needs 2GIS-specific search, routing, rich building data, or a sponsor-provided production subscription—not for visual polish alone.
- **Authoritative sources (reviewed 2026-09-23):** [2GIS MapGL getting started](https://docs.2gis.com/mapgl/start/first-steps), [API Platform FAQ](https://docs.2gis.com/en/api-platform), [Map Tiles API](https://docs.2gis.com/en/maps/others/maptiles/overview), [pricing and limits](https://docs.2gis.com/en/platform-manager/subscription/pricing), [copyright controls](https://docs.2gis.com/en/mapgl/map/configuration/controls), and [2GIS license agreement](https://law.2gis.ru/licensing-agreement).

### 2026-09-23 — Use an original generated Astana hero image

- **Reason:** the landing state must immediately communicate that the simulation is limited to Astana.
- **Decision:** bundle an original AI-generated blue-hour Astana skyline as a compressed JPG and pair it with a visible `Астана • Казахстан` badge; no remote image host is required.
- **Rejected:** hotlinking a third-party photograph with unclear competition and redistribution rights.

### 2026-09-23 — Make initiative application scope explicit

- **Reason:** inferring city scope from a null district is ambiguous for the map-based scenario
  builder and makes invalid combinations harder to explain.
- **Decision:** require `scope: "city" | "district"` on every decision, retain the organizer
  catalog's scope as the eligibility rule, and reject mismatches before simulation.
- **Trade-off:** this intentionally breaks the previous request shape; the separate frontend GIS
  redesign must send the explicit field. Costs, effects, and deterministic scoring are unchanged.
