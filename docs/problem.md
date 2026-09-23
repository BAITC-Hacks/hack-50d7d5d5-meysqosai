# Problem brief — «Аким на 5 часов»

## User and painful moment

- **Primary user:** a city manager, analyst, hackathon team, or simulator participant.
- **Setting:** the user receives the same synthetic Astana district data and a fixed budget of 100 units.
- **Painful moment:** five policy choices must balance transport, environment, social infrastructure, safety, and city services, but their delayed effects and trade-offs are difficult to compare mentally.
- **Desired outcome:** submit one valid five-decision scenario and immediately understand its Astana Quality of Life Score, district-level changes, strengths, risks, and trade-offs.

## Facts from the case and supplied dataset

- There are five synthetic districts: Yesil, Almaty, Saryarka, Baikonur, and Nura.
- Each district has a population share and ten 0–100 indicators grouped into five directions.
- The initiative catalog contains 14 measures with costs, district/city scope, implementation lag, and deterministic effects.
- Every scenario has budget 100 and exactly five unique decisions.
- A valid scenario uses no more than two measures from one direction and respects scope and incompatibility rules.
- The published baseline score is 52.56; the supplied example scenario costs 95 and is expected to score approximately 56.5.
- All data is synthetic/demo data and must be labelled as such in the UI.
- The LLM explains structured calculation results; it does not calculate or invent scores.

## Assumptions to validate

- One shared browser session is sufficient for the first demo; team accounts and authentication are not required.
- English and Russian labels can be stored together, but the first interface may use one primary language.
- The score formula and catalog in the supplied document are authoritative for the hackathon prototype.
- Comparing saved scenarios is useful after the Golden Path works, but is not required for the first slice.

## MVP outcome

### Demo scenario

The presenter starts from the common baseline, selects exactly five initiatives and required districts, sees the remaining budget and validation feedback live, submits the valid scenario, and receives a changed score with a concise explanation of who benefits and which risks remain.

### Three must-have capabilities

1. **Build a valid scenario:** show the shared baseline and catalog, collect exactly five decisions, require district targets where applicable, and prevent invalid or over-budget submission.
2. **Calculate deterministic impact:** apply lag-adjusted effects, synergies, incompatibilities, clipping, district weights, and the published score formula on the backend.
3. **Explain the result:** present score delta, district/indicator deltas, strengths, risks, and recommendations using an AI adapter with a deterministic mock fallback.
4. **Check against official practice:** on demand, build a small cache of official Astana claims and show source-bound advice below a completed scenario without changing the modeled score.

The explanation must use a shared city decision context rather than an isolated score. It includes the planning mission, what counts as a strong/attention/critical indicator, the current district baseline, the fixed resource envelope, equity goals, and reporting rules. A recalculation report must connect every conclusion to deterministic result fields and explicitly mention unresolved weaknesses and modeled trade-offs.

### Explicitly out of scope for the first MVP

- Using external municipal publications to calculate scores, live sensors, forecasting, or unsupported claims about official district performance. Official publications may be used only as a clearly separated advisory evidence layer.
- Authentication, multi-tenant team management, public leaderboards, payments, or production-grade authorization.
- AI-generated numeric effects or autonomous policy decisions.
- Surprise events, automatic slide generation, scenario sharing, and optimization until the Golden Path is verified.

## Data and responsibility

- **Source:** organizer-provided synthetic district dataset and initiative catalog in the linked Google Doc.
- **Sensitive fields:** none; do not add personal or operationally restricted data.
- **Retention:** the MVP may keep submitted scenarios in local SQLite for the current demo; no user identity is required.
- **Human decision:** the user chooses the five initiatives and district targets. The system validates and explains but does not choose policy on the user's behalf.
- **AI boundary:** core validation, costs, effects, and score are deterministic code. The explanatory AI receives structured synthetic results; the evidence workflow receives public official pages and must preserve source links, evidence type, confidence, and limitations.
- **AI reporting goal:** help a manager interpret whether the scenario improves the city, reduces critical deficits, supports the weakest district, stays within resources, and creates modeled negative side effects. It must not call a scenario successful merely because the headline score increased.
- **Fallback:** when AI is unavailable, return a template-based explanation derived from the same deterministic result; scoring must still work.

## Success criteria

- **Product:** a user can complete the five-decision flow without exceeding budget and can understand why the score changed.
- **Technical:** the supplied baseline calculates to 52.56 within rounding tolerance; the supplied example is valid and produces approximately 56.5; changing decisions changes the result.
- **Demo:** one complete scenario can be shown from reset to explanation in under two minutes with `AI_PROVIDER=mock`.
