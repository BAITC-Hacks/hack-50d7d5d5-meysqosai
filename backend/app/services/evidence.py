import json
from datetime import UTC, datetime
from typing import Any, Literal
from urllib.parse import urlparse

from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import Settings

Direction = Literal["transport", "environment", "social", "safety", "services"]
ClaimType = Literal[
    "plan",
    "reported_output",
    "reported_outcome",
    "independent_statistic",
    "audit_issue",
]
Confidence = Literal["high", "medium", "low"]
Assessment = Literal[
    "supported",
    "promising_with_conditions",
    "caution",
    "not_recommended",
    "insufficient_evidence",
]

ALLOWED_DOMAINS = (
    "gov.kz",
    "stat.gov.kz",
    "data.egov.kz",
    "budget.egov.kz",
    "rkastana.gov.kz",
)


class EvidenceCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    url: str = Field(min_length=12, max_length=2_000)
    publisher: str = Field(min_length=2, max_length=200)
    published_at: str = Field(min_length=4, max_length=40)
    direction: Direction
    claim_type: ClaimType
    claim: str = Field(min_length=10, max_length=1_000)
    confidence: Confidence
    limitations: list[str] = Field(max_length=3)


class EvidenceResearch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[EvidenceCandidate] = Field(min_length=1, max_length=15)


class AdviceRecommendationDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    initiative_id: str = Field(min_length=1, max_length=16)
    assessment: Assessment
    confidence: Confidence
    rationale: str = Field(min_length=10, max_length=1_200)
    conditions: list[str] = Field(max_length=4)
    evidence_ids: list[int] = Field(max_length=3)


class AdviceDigest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    proven_patterns: list[str] = Field(max_length=4)
    caution_signals: list[str] = Field(max_length=4)
    evidence_gaps: list[str] = Field(max_length=4)


class AdviceDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city_digest: AdviceDigest
    recommendations: list[AdviceRecommendationDraft] = Field(min_length=1, max_length=5)


class EvidenceServiceError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


async def research_evidence(settings: Settings) -> tuple[list[dict[str, Any]], str]:
    if settings.ai_provider == "mock":
        return [], "mock"
    if settings.ai_provider != "openai" or not settings.ai_api_key:
        raise EvidenceServiceError("PROVIDER_NOT_CONFIGURED")

    client = AsyncOpenAI(api_key=settings.ai_api_key, base_url=settings.ai_base_url or None)
    current_date = datetime.now(UTC).date().isoformat()
    try:
        response = await client.responses.parse(
            model=settings.ai_model,
            reasoning={"effort": "low"},
            tools=[
                {
                    "type": "web_search",
                    "filters": {"allowed_domains": list(ALLOWED_DOMAINS)},
                    "search_context_size": "medium",
                }
            ],
            include=["web_search_call.action.sources"],
            max_tool_calls=8,
            max_output_tokens=6_000,
            instructions=(
                "Ты исследователь городской политики. Ищи только официальные источники из "
                "разрешённых доменов и возвращай проверяемые факты об Астане. "
                "Не считай план или обещание доказательством успеха. Различай построенный объект, "
                "измеримый результат, независимую статистику и проблему государственного аудита. "
                "Одна карточка должна содержать один факт и прямую ссылку на страницу-источник. "
                "Самооценке акимата без независимой проверки обычно присваивай medium, плану low. "
                "Не используй персональные данные и не делай политических выводов."
            ),
            input=(
                f"Сегодня {current_date}. Найди 8–12 актуальных материалов за последние два года "
                "об Астане по транспорту, экологии, социальной инфраструктуре, безопасности и "
                "городским сервисам. Нужны как успешные измеримые результаты, так и ограничения, "
                "аудиторские замечания или недостаток подтверждений. По возможности включи "
                "статистику Бюро национальной статистики и материалы Ревизионной комиссии."
            ),
            text_format=EvidenceResearch,
        )
        parsed = response.output_parsed
        if parsed is None:
            raise EvidenceServiceError("EMPTY_RESEARCH_OUTPUT")
        source_urls = _source_urls(response.model_dump(warnings=False))
        items = _validated_items(parsed.items, source_urls)
        if not items:
            raise EvidenceServiceError("NO_VERIFIABLE_EVIDENCE")
        return items, "openai-web-search"
    except EvidenceServiceError:
        raise
    except (OpenAIError, ValidationError, ValueError, TypeError) as error:
        raise EvidenceServiceError("RESEARCH_REQUEST_FAILED") from error


async def advise_scenario(
    result: dict[str, Any],
    evidence: list[dict[str, Any]],
    settings: Settings,
) -> tuple[dict[str, Any], str]:
    fallback = _fallback_advice(result, evidence)
    if settings.ai_provider == "mock":
        return fallback, "mock"
    if settings.ai_provider != "openai" or not settings.ai_api_key:
        return fallback, "mock-fallback"

    selected = result["report_context"]["selected_decisions"]
    payload = {
        "scenario": {
            "baseline_score": result["baseline_score"],
            "final_score": result["final_score"],
            "score_delta": result["score_delta"],
            "critical_count": result["critical_count"],
            "goal_status": result["report_context"]["goal_status"],
            "tradeoffs": result["report_context"]["tradeoffs"],
            "selected_decisions": selected,
        },
        "retrieved_evidence": evidence,
    }
    try:
        client = AsyncOpenAI(api_key=settings.ai_api_key, base_url=settings.ai_base_url or None)
        response = await client.responses.parse(
            model=settings.ai_model,
            reasoning={"effort": "low"},
            max_output_tokens=4_000,
            instructions=(
                "Ты советник акима в демонстрационном симуляторе. Числа сценария синтетические, "
                "а retrieved_evidence содержит реальные официальные публикации. Не смешивай их. "
                "Для каждой выбранной инициативы оцени применимость опыта Астаны, используя только "
                "переданные evidence IDs. План не является успехом; self-reported outcome требует "
                "оговорки; audit_issue должен быть отражён как риск. Если доказательств нет, ставь "
                "insufficient_evidence. Не утверждай, что мера невозможна, без прямого доказательства."
            ),
            input=json.dumps(payload, ensure_ascii=False),
            text_format=AdviceDraft,
        )
        parsed = response.output_parsed
        if parsed is None:
            return fallback, "mock-fallback"
        finalized = _finalize_advice(parsed, selected, evidence)
        return finalized, "openai"
    except (OpenAIError, ValidationError, ValueError, TypeError):
        return fallback, "mock-fallback"


def retrieve_evidence(
    all_items: list[dict[str, Any]], decisions: list[dict[str, Any]], limit: int = 15
) -> list[dict[str, Any]]:
    directions = {decision["direction"] for decision in decisions}
    ranked = sorted(
        (item for item in all_items if item["direction"] in directions),
        key=lambda item: (
            0 if item["claim_type"] in {"independent_statistic", "audit_issue"} else 1,
            0 if item["confidence"] == "high" else 1 if item["confidence"] == "medium" else 2,
            item["id"],
        ),
    )
    return ranked[:limit]


def _validated_items(
    candidates: list[EvidenceCandidate], source_urls: set[str]
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for candidate in candidates:
        url = candidate.url.strip()
        if not _allowed_url(url):
            continue
        if source_urls and not _matches_source(url, source_urls):
            continue
        key = (_normalize_url(url), candidate.claim.casefold())
        if key in seen:
            continue
        seen.add(key)
        result.append(candidate.model_dump())
    return result


def _allowed_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    hostname = parsed.hostname.casefold()
    return any(hostname == domain or hostname.endswith(f".{domain}") for domain in ALLOWED_DOMAINS)


def _normalize_url(url: str) -> str:
    return url.rstrip("/")


def _matches_source(url: str, source_urls: set[str]) -> bool:
    candidate = _normalize_url(url)
    return any(
        candidate == source or candidate.startswith(f"{source}?") or source.startswith(f"{candidate}?")
        for source in source_urls
    )


def _source_urls(value: Any) -> set[str]:
    urls: set[str] = set()
    if isinstance(value, dict):
        url = value.get("url")
        if isinstance(url, str) and _allowed_url(url):
            urls.add(_normalize_url(url))
        for nested in value.values():
            urls.update(_source_urls(nested))
    elif isinstance(value, list):
        for nested in value:
            urls.update(_source_urls(nested))
    return urls


def _finalize_advice(
    draft: AdviceDraft,
    selected: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    selected_ids = {item["initiative_id"] for item in selected}
    evidence_by_id = {item["id"]: item for item in evidence}
    recommendations = []
    seen: set[str] = set()
    for item in draft.recommendations:
        if item.initiative_id not in selected_ids or item.initiative_id in seen:
            continue
        seen.add(item.initiative_id)
        sources = [
            evidence_by_id[evidence_id]
            for evidence_id in item.evidence_ids
            if evidence_id in evidence_by_id
        ]
        recommendations.append({**item.model_dump(exclude={"evidence_ids"}), "evidence": sources})
    if seen != selected_ids:
        raise ValueError("Advice did not cover every selected initiative")
    return {
        "city_digest": draft.city_digest.model_dump(),
        "recommendations": recommendations,
    }


def _fallback_advice(
    result: dict[str, Any], evidence: list[dict[str, Any]]
) -> dict[str, Any]:
    selected = result["report_context"]["selected_decisions"]
    by_direction: dict[str, list[dict[str, Any]]] = {}
    for item in evidence:
        by_direction.setdefault(item["direction"], []).append(item)

    recommendations = []
    for decision in selected:
        matches = by_direction.get(decision["direction"], [])[:2]
        audit = next((item for item in matches if item["claim_type"] == "audit_issue"), None)
        outcome = next(
            (
                item
                for item in matches
                if item["claim_type"] in {"reported_outcome", "independent_statistic"}
            ),
            None,
        )
        if audit:
            assessment: Assessment = "caution"
            rationale = f"Официальный аудит указывает на риск: {audit['claim']}"
        elif outcome:
            assessment = "promising_with_conditions"
            rationale = f"Есть релевантный официальный результат: {outcome['claim']}"
        elif matches:
            assessment = "insufficient_evidence"
            rationale = "Найдены официальные планы или результаты работ, но недостаточно данных об эффекте."
        else:
            assessment = "insufficient_evidence"
            rationale = "В текущем кэше нет официальных доказательств по этому направлению."
        recommendations.append(
            {
                "initiative_id": decision["initiative_id"],
                "assessment": assessment,
                "confidence": outcome["confidence"] if outcome else "low",
                "rationale": rationale,
                "conditions": ["Проверить актуальность источника и локальные условия района."],
                "evidence": matches,
            }
        )

    outcomes = [
        item["claim"]
        for item in evidence
        if item["claim_type"] in {"reported_outcome", "independent_statistic"}
    ][:4]
    cautions = [item["claim"] for item in evidence if item["claim_type"] == "audit_issue"][:4]
    covered = {item["direction"] for item in evidence}
    gaps = [
        f"Нет достаточных доказательств по направлению {decision['direction_name_ru']}."
        for decision in selected
        if decision["direction"] not in covered
    ]
    return {
        "city_digest": {
            "proven_patterns": outcomes,
            "caution_signals": cautions,
            "evidence_gaps": list(dict.fromkeys(gaps)),
        },
        "recommendations": recommendations,
    }
