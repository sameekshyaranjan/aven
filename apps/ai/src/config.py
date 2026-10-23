"""Validated settings for the advisory service."""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore"
    )

    PORT: int = Field(default=8000, ge=1, le=65535)
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    DATABASE_URL: str | None = None
    GEMINI_API_KEY: str | None = None
    EMBEDDING_MODEL: str = "gemini-embedding-2"
    CHAT_MODEL: str = "gemini-1.5-pro"


settings = Settings()
