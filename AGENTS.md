# Codex working agreement

This repository is optimized for a solo hackathon. Prefer the smallest reliable design that can be explained in a two-minute demo.

## Working loop

1. Restate the small task and its acceptance criteria.
2. Inspect the relevant files before editing.
3. Before a major architecture, dependency, database, or deployment change, explain the decision and trade-offs first.
4. Implement one understandable vertical slice.
5. Run the narrowest relevant check, then `./scripts/check.sh` before a commit.
6. Summarize changed files, behavior, tests, and remaining risks.
7. Review `git diff` with the user; keep commits small and descriptive.

## Constraints

- Keep one frontend, one backend, and one database. Do not introduce microservices.
- Use SQLite until scale, concurrency, or deployment requirements clearly require PostgreSQL.
- Keep `AI_PROVIDER=mock` as the credential-free default.
- Never print, commit, log, or copy values from `.env`, API keys, tokens, credentials, or personal data.
- Do not read `.env` unless the user explicitly asks to diagnose environment configuration; inspect variable names, not secret values.
- Put API contracts in `docs/api.md` and material architecture decisions in `docs/architecture.md`.
- Add dependencies only when standard-library or existing-project options are inadequate.
- Preserve user changes and avoid broad rewrites during a timed hackathon.

## Commands

- Backend: `source backend/.venv/bin/activate && uvicorn app.main:app --app-dir backend --reload --port 8000`
- Frontend: `npm --prefix frontend run dev`
- Full check: `./scripts/check.sh`
- API smoke requests: use `requests.http` in VS Code or curl.

For OpenAI product or API questions, use the configured `openaiDeveloperDocs` MCP server and official OpenAI documentation.

## Organizer / AI tester handoff

Run from the repository root. Follow README prerequisites, run `./scripts/setup.sh`
and `./scripts/check.sh`, and explicitly use `AI_PROVIDER=mock` for a credential-free
demo. Tests isolate configuration and use a temporary database. Use the 95-unit
example in README / requests.http; expected score is 56.5431. Complete all five
scenarios, submit, and check ties and invalid selections. A mock fallback is not
proof that live credentials work. Do not request keys for deterministic testing.

## Repository-local skills and prompt provenance

Read the relevant skill completely before its workflow. These Markdown files can
be used by any AI tester without Codex plugins:

- `skills/shape-mvp/SKILL.md`: scope and architecture planning when needed.
- `skills/implement-mvp-slice/SKILL.md`: small end-to-end implementation.
- `skills/verify-debug/SKILL.md`: focused diagnosis and regression checks.
- `skills/ship-hackathon/SKILL.md`: submission readiness and honest limitations.

Implementation, verification and submission workflows guide project work; their
presence does not imply every deployment or evaluation step is complete.
`docs/master-implementation-prompt.md` is the planning brief. `ai/prompts.md` indexes
runtime instructions in backend code. Never copy private chat history, keys or
personal information into prompts or these files.
