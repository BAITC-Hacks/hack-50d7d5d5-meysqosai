from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    data_path: str = "data/app.db"
    frontend_origin: str = "http://localhost:5173"
    ai_provider: str = "mock"
    ai_model: str = "gpt-5-mini"
    ai_api_key: str | None = None
    ai_base_url: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
