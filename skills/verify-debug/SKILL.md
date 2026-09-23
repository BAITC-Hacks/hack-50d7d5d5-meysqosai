---
name: verify-debug
description: Reproduce, diagnose, test, and fix failures in the hackathon project with minimal changes and clear evidence. Use for bugs, failing tests, integration issues, or pre-commit verification.
---

Start from the exact symptom, command, input, expected result, and actual result. Check recent diffs and logs without exposing secret values.

1. Reproduce the smallest failing case.
2. Determine whether the failure is environment, frontend, API, database, AI provider, or deployment related.
3. Form one evidence-based hypothesis and run the narrowest diagnostic that can disprove it.
4. Make the smallest fix at the source. Add a regression test when practical.
5. Run the original reproduction, related tests, and then `./scripts/check.sh`.

Report root cause, evidence, fix, verification, remaining uncertainty, and recovery steps. Do not hide failures with broad exception handling, disabled checks, or fabricated fallback data.
