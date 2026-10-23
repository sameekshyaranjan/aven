"""FastAPI entry point: python -m uvicorn main:app --reload --no-access-log."""

import json
import logging
from time import perf_counter_ns
from uuid import uuid4

from fastapi import FastAPI, Request

from src.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title="Aven AI Advisory Service", version="0.1.0")
    logger = logging.getLogger("aven.ai")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    @app.middleware("http")
    async def safe_request_log(request: Request, call_next):
        started = perf_counter_ns()
        request_id = str(uuid4())
        try:
            response = await call_next(request)
        except Exception:
            logger.error(json.dumps({"request_id": request_id, "status": 500}))
            raise
        response.headers["X-Request-Id"] = request_id
        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "method": request.method,
                    "status": response.status_code,
                    "duration_ms": round((perf_counter_ns() - started) / 1_000_000, 2),
                }
            )
        )
        return response

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "aven-ai", "environment": settings.ENVIRONMENT}

    return app


app = create_app()
