# MeysQosAI — «Аким на 5 часов»

MeysQosAI is an AI-assisted city-management simulator for the HackAlem case
«Аким на 5 часов». A participant allocates a shared virtual budget across exactly
five initiatives and receives a deterministic Astana Quality of Life Score with
an AI explanation of impacts, risks, and trade-offs.

Current status: **five sequential scenarios, explicit submission, comparison-first AI report,
official-source advice, and Russian-language results dialog are implemented.**

The existing hackathon starter provides:

- React + TypeScript + Vite frontend
- FastAPI backend
- SQLite by default (no database service required)
- Mock AI mode that works without an API key
- Optional OpenAI-compatible provider adapter
- pytest, Ruff, ESLint, and production builds for verification

## First setup

```bash
cp .env.example .env
./scripts/setup.sh
```

Do not put real keys in `.env.example`. Put organizer credentials only in the local `.env`, which Git ignores.

## Planned Golden Path

```text
Shared synthetic baseline → choose five initiatives → validate budget/rules
→ deterministic district and city score → AI/mock explanation
```

All numbers are calculated by code from the supplied synthetic dataset. AI only
explains structured results and never invents effects or scores. See
[`docs/problem.md`](docs/problem.md), [`docs/architecture.md`](docs/architecture.md),
and [`docs/api.md`](docs/api.md).

The working product and UX priorities are captured in
[`docs/master-implementation-prompt.md`](docs/master-implementation-prompt.md).

## Run the application

Terminal 1:

```bash
source backend/.venv/bin/activate
uvicorn app.main:app --app-dir backend --reload --port 8000
```

Terminal 2:

```bash
npm --prefix frontend run dev
```

Open <http://localhost:5173>. API documentation is at <http://localhost:8000/docs>.

## Verify before every commit

```bash
./scripts/check.sh
git diff --check
git status --short
```

## Repository map

```text
backend/          FastAPI, SQLite, and AI provider code
frontend/         React application
data/             Local data only; database files are ignored
ai/               Prompt and evaluation notes
docs/             Problem, architecture, API, demo, submission
tests/            Cross-stack tests when needed
scripts/          Repeatable setup and health checks
skills/           Reusable Codex hackathon workflows
```

The backend exposes the full catalog through `GET /api/simulator`, validates drafts
through `POST /api/scenarios/validate`, and calculates valid scenarios through
`POST /api/scenarios/simulate`. The published example calculates to `56.5431`
from an exact baseline of `52.5577` (displayed as 56.5 and 52.56).

The Russian-language frontend provides five locally persisted scenario tabs, an
interactive OpenStreetMap view with published Astana district geometry, visible
city and district indicators, immediate budget feedback, citywide/district impact
highlighting, and calculated scenario results. Five mapped districts are connected
to the synthetic simulator; Saraishyk is retained as geographic context and clearly
marked as outside the current model. The OSM tiles require an internet connection,
while the district GeoJSON and the generated Astana hero image are bundled locally.

Map attribution and provenance are displayed in the interface. The geometry was
adapted from the Astana Aqua Ops baseline and points to the Astana architecture GIS
service; its publication date, current administrative accuracy, and reuse license
have not been independently verified, so it must not be presented as official or
current municipal boundary data.

See [docs/deployment.md](docs/deployment.md) when the organizer's hosting constraints are known.
