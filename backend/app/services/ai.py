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


class ComparisonExplanation(BaseModel):
    conclusion: str
    reasons: list[str]
    limitations: list[str]


async def compare_results(results: list[dict[str, Any]], settings: Settings) -> dict[str, Any]:
    best_score = max(item["final_score"] for item in results)
    winners = [index for index, item in enumerate(results) if item["final_score"] == best_score]
    labels = ", ".join(str(index + 1) for index in winners)
    fallback = ComparisonExplanation(
        conclusion=(f"Лучший результат по индексу качества жизни: {best_score:.2f}. "
                    f"Сценарии с этим результатом: {labels}. "
                    + ("При равных индексах единственного победителя нет." if len(winners) > 1
                       else "Этот сценарий занимает первое место по правилам модели.")),
        reasons=["Сравнение выполнено по итоговому индексу при одинаковом исходном состоянии.",
                 "Неиспользованный бюджет не добавляет бонусных баллов."],
        limitations=["Индекс основан на синтетических данных.",
                     "Перед выбором изучите оставшиеся дефициты и отрицательные эффекты каждого варианта."],
    )
    provider = "mock" if settings.ai_provider == "mock" else "mock-fallback"
    explanation = fallback
    if settings.ai_provider == "openai" and settings.ai_api_key:
        try:
            async with AsyncOpenAI(api_key=settings.ai_api_key,
                                   base_url=settings.ai_base_url or None,
                                   timeout=60, max_retries=0) as client:
                response = await client.responses.parse(
                    model=settings.ai_model,
                    instructions=(
                        "Напиши общий вывод для акима на русском языке. Сначала назови лучший "
                        "сценарий по рассчитанному индексу, затем объясни преимущества и ограничения "
                        "в сравнении с другими вариантами. Номера сценариев начинаются с 1. "
                        "Победители уже рассчитаны сервером, не меняй их и не пересчитывай числа. "
                        "При равенстве укажи всех лидеров без выдуманного победителя. "
                        "Не давай бонус за остаток бюджета. Данные синтетические. "
                        "Учитывай критические дефициты, слабейший район и компромиссы."
                    ),
                    input=json.dumps({"winner_numbers": [i + 1 for i in winners], "scenarios": [
                        {"number": i + 1, "final_score": r["final_score"],
                         "report_context": r["report_context"]} for i, r in enumerate(results)
                    ]}, ensure_ascii=False),
                    text_format=ComparisonExplanation,
                )
                if response.output_parsed:
                    explanation = response.output_parsed
                    provider = "openai"
        except (OpenAIError, ValidationError, ValueError, TypeError):
            pass
    return {"winner_indexes": winners, "best_score": best_score, "provider": provider,
            **explanation.model_dump()}


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
                "Рост общего индекса не отменяет критические дефициты, слабый район или компромиссы. "
                "Пиши пояснения полностью по-русски: индекс качества жизни, исходное состояние, "
                "бюджетные единицы. Не используй английские термины в значениях полей. "
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
            f"(индекс {weakest['score']:.2f})."
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
            f"Индекс качества жизни изменился с {result['baseline_score']:.2f} до "
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
                f"с индексом {goal['weakest_district']['score']:.2f}."
            ),
        ],
        tradeoffs=tradeoffs,
        resource_assessment=(
            f"Использовано {resources['spent']} из {resources['budget']} бюджетных единиц; "
            f"резерв {resources['remaining']}. Выбрано {resources['decisions_used']} из "
            f"{resources['decisions_required']} обязательных решений по "
            f"{len(report['coverage']['directions_used'])} направлениям."
        ),
        recommendations=[recommendation],
    ).model_dump()
