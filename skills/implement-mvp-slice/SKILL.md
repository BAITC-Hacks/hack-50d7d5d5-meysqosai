---
name: implement-mvp-slice
description: Implement one end-to-end hackathon feature across the existing React, FastAPI, SQLite, or AI adapter layers. Use for frontend, backend, API, database, or LLM implementation work after scope is defined.
---

Read `AGENTS.md`, the relevant section of `docs/api.md`, and the files in the requested path.

1. Restate one observable user outcome and acceptance criteria.
2. Trace the thin path from UI to API to persistence or AI adapter. Reuse existing patterns and dependencies.
3. If the task changes an API contract, data model, provider, or major dependency, explain the decision before editing and update the relevant document.
4. Implement only the slice. Keep credentials server-side and preserve credential-free mock behavior.
5. Add or update focused tests. Run the narrow check first, then `./scripts/check.sh` when the slice is complete.
6. Summarize behavior, changed files, verification, limitations, and a suggested small commit message.

Do not add a service, framework, abstraction, or dependency for a hypothetical future need.
