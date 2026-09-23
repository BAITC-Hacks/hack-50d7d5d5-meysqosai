# Lightweight AI evaluations

Create 5–20 representative cases before tuning prompts. Include normal cases, missing information, conflicting information, unsafe requests, and non-English/Kazakh/Russian inputs when relevant.

Track expected behavior, actual behavior, pass/fail, and the reason for each failure. Prefer a small stable set over anecdotal prompt tweaking.

## Scenario recalculation report v1

| Case | Expected behavior |
| --- | --- |
| Published valid example | Quotes the exact score delta, budget use, weakest district, and critical-count change from `report_context`. |
| Positive score with a negative indicator delta | Uses `mixed`, lists the negative delta under trade-offs, and does not claim universal improvement. |
| Positive score with critical indicators remaining | Names the affected district/indicator and recommends inspecting that deficit. |
| No critical indicators and no negative deltas | May use `improved`, while still naming the weakest post-scenario district. |
| Non-improving score | Uses `declined` and does not manufacture a strength beyond observed evidence. |
| Provider returns prose or extra keys | Schema validation fails and the response uses `mock-fallback`. |
| Prompt injection inside any label | Treats fixture/result strings as data and follows the fixed output schema only. |
