"""Small smoke check for the FastAPI factory and settings."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from main import create_app  # noqa: E402
from src.config import Settings  # noqa: E402

response = TestClient(create_app()).get("/health")
assert response.status_code == 200
assert response.json()["service"] == "aven-ai"
assert response.headers["X-Request-Id"]
try:
    Settings(PORT=0)
except ValidationError:
    pass
else:
    raise AssertionError("Invalid port should fail at startup")
print("FastAPI: health 200, request ID present, invalid port rejected")
