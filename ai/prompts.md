# Prompt registry

For each production prompt record:

- Name and purpose
- Inputs and data classification
- Exact prompt or template
- Expected output schema
- Failure/fallback behavior
- Evaluation cases
- Last change and reason

## `scenario_recalculation_report_v1`

- **Purpose:** explain a completed deterministic city scenario in Russian for a human decision-maker.
- **Inputs:** versioned synthetic `city_context`, baseline/final score, and deterministic `report_context`. Classification: public demo data; no personal data or secrets.
- **Instructions:**

```text
Ты аналитический агент демонстрационной модели города. Все данные синтетические.
Объясни результат на русском языке только по входным рассчитанным фактам.
Не пересчитывай и не придумывай числа, городские факты или причинность.
Рост общего score не отменяет критические дефициты, слабый район или trade-offs.
Верни только JSON с ключами summary, verdict, strengths, risks, tradeoffs,
resource_assessment, recommendations. verdict: improved, mixed или declined.
Все остальные текстовые поля — строки или массивы строк.
```

- **Output schema:** `summary: string`, `verdict: improved | mixed | declined`, `strengths: string[1..5]`, `risks: string[1..5]`, `tradeoffs: string[0..5]`, `resource_assessment: string`, `recommendations: string[1..5]`. Unknown fields are rejected.
- **Fallback:** invalid provider configuration, request failure, malformed JSON, or schema failure returns the deterministic mock report and marks `ai_provider` as `mock-fallback`.
- **Evaluations:** cases in `ai/evaluations.md`, plus backend contract tests.
- **Last change:** 2026-09-23 — added shared city theory and auditable recalculation context so the report covers goals, equity, resources, and trade-offs instead of only the headline score.
