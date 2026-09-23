# Runtime prompt registry

Executable code is the source of truth; this index avoids duplicated prompt text.
Reports are requested in Russian. Never include credentials or personal records.

| Purpose | Source entry point | Inputs and boundaries |
| --- | --- | --- |
| Recalculation report | backend/app/services/ai.py::explain_simulation | City theory + calculated report context; ScenarioExplanation schema; deterministic fallback |
| Overall comparison first | backend/app/services/ai.py::compare_results | Five results + server-selected winners; all ties retained; ComparisonExplanation schema |
| Official research | backend/app/services/evidence.py::research_evidence | Astana instructions, allowlisted web search and structured claims; manual paid refresh |
| Source-based advice | backend/app/services/evidence.py::advise_scenario | Calculated scenario + direction-retrieved evidence; supplied citation IDs only; fallback |

Shared theory lives in data/simulator.json. The simulator derives city_context and
report_context; news never changes scores. Source content and model output are
untrusted: schema validation is not factual verification.

## Development provenance

- [Master brief](../docs/master-implementation-prompt.md): original product/UX planning
  prompt, not a claim that all aspirations were implemented.
- [AGENTS.md](../AGENTS.md): current coding, testing and handoff instructions.
- [Local skills](../skills/): shape-mvp, implement-mvp-slice, verify-debug and
  ship-hackathon. Readable Markdown workflows, not runtime application dependencies.
- [Evaluations](evaluations.md): qualitative cases alongside backend tests.

Change prompts in their source functions, update this index when responsibilities
change, and verify mock fallback and structured-output handling. Do not commit
private chat history or secret-bearing prompts.
