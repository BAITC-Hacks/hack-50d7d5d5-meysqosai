---
name: ship-hackathon
description: Prepare documentation, demo, deployment checks, and final submission review for a solo AI hackathon. Use near milestones, rehearsals, deployment, or final submission.
---

Read `README.md`, `docs/demo-script.md`, and `docs/submission-checklist.md`.

1. Freeze scope unless a blocker prevents the primary demo path.
2. Run `./scripts/check.sh`, inspect `git status` and `git diff --check`, and verify no secrets or local databases are tracked.
3. Test the main scenario with realistic non-sensitive data, mock mode, and the configured real provider if authorized.
4. Verify setup instructions, deployed URLs, health endpoint, error states, and a clean restart.
5. Tighten the demo script to the time limit. Prepare sample input, screenshots or recording, and a local fallback.
6. Complete every applicable submission checkbox with evidence; call out unresolved risks rather than guessing.

End with a go/no-go result, exact blockers, recovery instructions, and the final submission sequence. Avoid late refactors and cosmetic work that does not improve judging or reliability.
