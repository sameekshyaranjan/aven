"""Configuration settings for Aven AI Service."""
import os
from typing import Optional

try:
    from pydantic_settings import BaseSettings

    class Settings(BaseSettings):
        PORT: int = 8000
        ENVIRONMENT: str = "development"
        DATABASE_URL: Optional[str] = None
        GEMINI_API_KEY: Optional[str] = None
        EMBEDDING_MODEL: str = "text-embedding-004"
        CHAT_MODEL: str = "gemini-1.5-pro"

        class Config:
            env_file = ".env"
            extra = "ignore"

    settings = Settings()

except ImportError:
    # Lightweight fallback before dependencies are installed
    class FallbackSettings:
        PORT: int = int(os.getenv("PORT", "8000"))
        ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
        DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
        GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
        EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
        CHAT_MODEL: str = os.getenv("CHAT_MODEL", "gemini-1.5-pro")

    settings = FallbackSettings()  # type: ignore
