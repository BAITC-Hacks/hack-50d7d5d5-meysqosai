from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from app.config import Settings, get_settings
from app.database import create_note, initialize, list_notes
from app.services.ai import summarize
from app.services.simulator import (
    FixtureError,
    ScenarioValidationError,
    catalog,
    load_fixture,
    simulate,
    validate_scenario,
)


class NoteInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=5_000)


class TextInput(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)


class DecisionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    initiative_id: str = Field(min_length=1, max_length=16)
    district_id: str | None = Field(default=None, min_length=1, max_length=64)


class ScenarioInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decisions: list[DecisionInput] = Field(max_length=14)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize(get_settings().data_path)
    yield


settings = get_settings()
app = FastAPI(title="Solo Hackathon API", version="0.1.0", lifespan=lifespan)
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
def simulate_scenario(
    payload: ScenarioInput,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    decisions = [decision.model_dump() for decision in payload.decisions]
    try:
        return simulate(simulator_fixture(settings), decisions)
    except ScenarioValidationError as error:
        raise HTTPException(status_code=422, detail=error.validation) from error


@app.get("/api/notes")
def notes(settings: Annotated[Settings, Depends(get_settings)]) -> list[dict[str, object]]:
    return list_notes(settings.data_path)


@app.post("/api/notes", status_code=201)
def add_note(
    payload: NoteInput,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    return create_note(settings.data_path, payload.title, payload.body)


@app.post("/api/ai/summarize")
async def ai_summary(
    payload: TextInput,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    try:
        result, provider = await summarize(payload.text, settings)
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"summary": result, "provider": provider}
