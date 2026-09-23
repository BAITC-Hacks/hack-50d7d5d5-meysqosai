---
name: shape-mvp
description: Turn a hackathon brief into a sharply scoped solo MVP plan, architecture, API contract, and data model before implementation. Use when starting a project or reconsidering scope or architecture.
---

Read `docs/problem.md`, `docs/architecture.md`, and `docs/api.md`.

1. Identify the primary user, painful moment, evidence, desired outcome, and demo scenario. Separate facts from assumptions.
2. Define no more than three must-have capabilities and a clear out-of-scope list.
3. Propose the simplest vertical architecture that fits the constraints. Keep the existing monolith and SQLite unless a concrete requirement forces change.
4. Define the smallest API and data model needed for the demo. Identify sensitive fields, retention needs, AI boundaries, human decisions, and fallback behavior.
5. Write the decisions into the three documents before implementation.

End with one small first slice, acceptance criteria, risks, and the command that will verify it. Do not create speculative infrastructure or implementation detail that the demo does not need.
