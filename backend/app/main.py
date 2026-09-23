from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from app.config import Settings, get_settings
from app.database import (
    evidence_status as load_evidence_status,
)
from app.database import (
    initialize,
    list_evidence,
    record_evidence_sync,
    replace_evidence,
)
from app.services.ai import compare_results, explain_simulation
from app.services.evidence import (
    EvidenceServiceError,
    advise_scenario,
    research_evidence,
    retrieve_evidence,
)
from app.services.simulator import (
    FixtureError,
    ScenarioValidationError,
    catalog,
    load_fixture,
    simulate,
    validate_scenario,
)


class DecisionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    initiative_id: str = Field(min_length=1, max_length=16)
    scope: Literal["city", "district"]
    district_id: str | None = Field(default=None, min_length=1, max_length=64)


class ScenarioInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decisions: list[DecisionInput] = Field(max_length=14)


class ComparisonInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenarios: list[ScenarioInput] = Field(min_length=5, max_length=5)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize(get_settings().data_path)
    yield


settings = get_settings()
app = FastAPI(title="MeysQosAI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health(settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env, "ai_provider": settings.ai_provider}


def simulator_fixture(settings: Settings) -> dict[str, object]:
    try:
        return load_fixture(settings.simulator_data_path)
    except FixtureError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/api/simulator")
def simulator_catalog(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    return catalog(simulator_fixture(settings))


@app.post("/api/scenarios/validate")
def validate_simulator_scenario(
    payload: ScenarioInput,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    decisions = [decision.model_dump() for decision in payload.decisions]
    return validate_scenario(simulator_fixture(settings), decisions)


@app.post("/api/scenarios/simulate")
async def simulate_scenario(
    payload: ScenarioInput,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    decisions = [decision.model_dump() for decision in payload.decisions]
    fixture = simulator_fixture(settings)
    try:
        result = simulate(fixture, decisions)
    except ScenarioValidationError as error:
        raise HTTPException(status_code=422, detail=error.validation) from error
    explanation, provider = await explain_simulation(
        result, catalog(fixture)["city_context"], settings
    )
    result["explanation"] = explanation
    result["ai_provider"] = provider
    return result


@app.post("/api/scenarios/compare")
async def compare_scenarios(
    payload: ComparisonInput,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    fixture = simulator_fixture(settings)
    try:
        results = [simulate(fixture, [item.model_dump() for item in scenario.decisions])
                   for scenario in payload.scenarios]
    except ScenarioValidationError as error:
        raise HTTPException(status_code=422, detail=error.validation) from error
    return await compare_results(results, settings)


@app.get("/api/evidence/status")
def official_evidence_status(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    return load_evidence_status(settings.data_path)


@app.get("/api/evidence")
def official_evidence(
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[dict[str, object]]:
    return list_evidence(settings.data_path)


@app.post("/api/evidence/refresh")
async def refresh_official_evidence(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    cached = list_evidence(settings.data_path)
    try:
        items, provider = await research_evidence(settings)
        if not items:
            status = "cached" if cached else "unavailable"
            record_evidence_sync(
                settings.data_path,
                status=status,
                provider=provider,
                item_count=len(cached),
                error_code="LIVE_RESEARCH_DISABLED",
            )
        else:
            replace_evidence(settings.data_path, items, provider)
    except EvidenceServiceError as error:
        status = "cached" if cached else "error"
        record_evidence_sync(
            settings.data_path,
            status=status,
            provider="openai-web-search",
            item_count=len(cached),
            error_code=error.code,
        )
        if not cached:
            raise HTTPException(
                status_code=503,
                detail="Не удалось обновить официальные источники. Попробуйте позже.",
            ) from error
    return load_evidence_status(settings.data_path)


@app.post("/api/scenarios/advise")
async def advise_simulator_scenario(
    payload: ScenarioInput,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    decisions = [decision.model_dump() for decision in payload.decisions]
    fixture = simulator_fixture(settings)
    try:
        result = simulate(fixture, decisions)
    except ScenarioValidationError as error:
        raise HTTPException(status_code=422, detail=error.validation) from error

    available = list_evidence(settings.data_path)
    if not available:
        raise HTTPException(
            status_code=409,
            detail="Сначала обновите базу официальных источников.",
        )
    selected = result["report_context"]["selected_decisions"]
    retrieved = retrieve_evidence(available, selected)
    advice, provider = await advise_scenario(result, retrieved, settings)
    return {
        "data_mode": "MIXED",
        "disclosure": (
            "Баллы сценария синтетические; ссылки и факты взяты из официальных публикаций "
            "и не изменяют расчёт автоматически."
        ),
        "evidence_status": load_evidence_status(settings.data_path),
        "advice_provider": provider,
        **advice,
    }
