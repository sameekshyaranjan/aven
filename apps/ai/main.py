"""FastAPI Application entry point for Aven AI Service."""
import logging

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
except ImportError:
    FastAPI = None  # type: ignore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aven-ai")


def create_app():
    if FastAPI is None:
        raise RuntimeError(
            "FastAPI is not installed. Please set up the virtual environment and install dependencies."
        )

    app = FastAPI(
        title="Aven AI Advisory Service",
        description="Stateless document extraction, clause retrieval, and candidate analysis workflow engine.",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:4000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health_check():
        return {
            "status": "ok",
            "service": "aven-ai",
            "version": "0.1.0",
        }

    return app


if FastAPI is not None:
    app = create_app()
else:
    app = None
