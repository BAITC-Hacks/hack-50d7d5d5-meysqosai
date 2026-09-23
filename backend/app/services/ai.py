import json
from typing import Any, Literal

from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import Settings


class ScenarioExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=1_000)
    verdict: Literal["improved", "mixed", "declined"]
    strengths: list[str] = Field(min_length=1, max_length=5)
    risks: list[str] = Field(min_length=1, max_length=5)
    tradeoffs: list[str] = Field(max_length=5)
    resource_assessment: str = Field(min_length=1, max_length=1_000)
    recommendations: list[str] = Field(min_length=1, max_length=5)


async def summarize(text: str, settings: Settings) -> tuple[str, str]:
    if settings.ai_provider == "mock":
        compact = " ".join(text.split())
        suffix = "…" if len(compact) > 240 else ""
        return f"Mock summary: {compact[:240]}{suffix}", "mock"

    if settings.ai_provider != "openai":
        raise ValueError(f"Unsupported AI_PROVIDER: {settings.ai_provider}")
    if not settings.ai_api_key:
        raise ValueError("AI_API_KEY is required when AI_PROVIDER=openai")

    client = AsyncOpenAI(
        api_key=settings.ai_api_key,
        base_url=settings.ai_base_url or None,
    )
    response = await client.responses.create(
        model=settings.ai_model,
        instructions=(
            "Summarize the supplied public-service text in plain language. "
            "Do not invent facts. State when important context is missing."
        ),
        input=text,
    )
    return response.output_text, "openai"


async def explain_simulation(
    result: dict[str, Any], city_context: dict[str, Any], settings: Settings
) -> tuple[dict[str, Any], str]:
    fallback = _mock_scenario_explanation(result)
    if settings.ai_provider == "mock":
        return fallback, "mock"
    if settings.ai_provider != "openai" or not settings.ai_api_key:
        return fallback, "mock-fallback"

    payload = {
        "city_context": city_context,
        "recalculation": {
            "baseline_score": result["baseline_score"],
            "final_score": result["final_score"],
            "report_context": result["report_context"],
        },
    }
    try:
        client = AsyncOpenAI(
            api_key=settings.ai_api_key,
            base_url=settings.ai_base_url or None,
        )
        response = await client.responses.create(
            model=settings.ai_model,
            instructions=(
                "Ты аналитический агент демонстрационной модели города. Все данные синтетические. "
                "Объясни результат на русском языке только по входным рассчитанным фактам. "
                "Не пересчитывай и не придумывай числа, городские факты или причинность. "
                "Рост общего score не отменяет критические дефициты, слабый район или trade-offs. "
                "Верни только JSON с ключами summary, verdict, strengths, risks, tradeoffs, "
                "resource_assessment, recommendations. verdict: improved, mixed или declined. "
                "Все остальные текстовые поля — строки или массивы строк."
            ),
            input=json.dumps(payload, ensure_ascii=False),
        )
        parsed = json.loads(response.output_text)
        explanation = ScenarioExplanation.model_validate(parsed)
        return explanation.model_dump(), "openai"
    except (OpenAIError, json.JSONDecodeError, TypeError, ValidationError):
        return fallback, "mock-fallback"


def _mock_scenario_explanation(result: dict[str, Any]) -> dict[str, Any]:
    report = result["report_context"]
    goal = report["goal_status"]
    strongest_district = max(
        result["district_results"], key=lambda district: district["score_delta"]
    )
    critical = report["remaining_critical_indicators"]
    tradeoff_items = report["tradeoffs"]

    if result["score_delta"] > 0 and not critical and not tradeoff_items:
        verdict = "improved"
    elif result["score_delta"] > 0:
        verdict = "mixed"
    else:
        verdict = "declined"

    if critical:
        critical_risk = (
            f"Остаётся {len(critical)} показателей ниже критического порога 40; "
            f"первый — {critical[0]['district_name_ru']}, "
            f"{critical[0]['indicator_name_ru']}: {critical[0]['value']:.2f}."
        )
        first = critical[0]
        recommendation = (
            f"Проверить следующий сценарий на устранение дефицита «{first['indicator_name_ru']}» "
            f"в районе {first['district_name_ru']} без нарушения ресурсных ограничений."
        )
    else:
        critical_risk = "После перерасчёта показателей ниже критического порога 40 нет."
        weakest = goal["weakest_district"]
        recommendation = (
            f"Перед решением сравнить альтернативу для слабейшего района {weakest['name_ru']} "
            f"(score {weakest['score']:.2f})."
        )

    tradeoffs = [
        (
            f"{item['district_name_ru']}: «{item['indicator_name_ru']}» "
            f"изменяется на {item['delta']:+.2f}."
        )
        for item in tradeoff_items[:5]
    ]
    if not tradeoffs:
        tradeoffs = ["В рассчитанных индикаторах отрицательных изменений нет."]

    resources = report["resource_use"]
    return ScenarioExplanation(
        summary=(
            f"Quality of Life Score изменился с {result['baseline_score']:.2f} до "
            f"{result['final_score']:.2f} ({result['score_delta']:+.2f})."
        ),
        verdict=verdict,
        strengths=[
            (
                f"Наибольший прирост у района {strongest_district['name_ru']}: "
                f"{strongest_district['score_delta']:+.2f}."
            ),
            (
                f"Критических показателей стало {goal['critical_count_after']} "
                f"против {goal['critical_count_before']} до сценария."
            ),
        ],
        risks=[
            critical_risk,
            (
                f"Слабейший район после расчёта — {goal['weakest_district']['name_ru']} "
                f"со score {goal['weakest_district']['score']:.2f}."
            ),
        ],
        tradeoffs=tradeoffs,
        resource_assessment=(
            f"Использовано {resources['spent']} из {resources['budget']} coin; "
            f"резерв {resources['remaining']}. Выбрано {resources['decisions_used']} из "
            f"{resources['decisions_required']} обязательных решений по "
            f"{len(report['coverage']['directions_used'])} направлениям."
        ),
        recommendations=[recommendation],
    ).model_dump()
