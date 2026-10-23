"""Validate the same synthetic examples as the TypeScript contract check."""

import json
from pathlib import Path
import sys

from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "ai"))

from src.contracts import AiCallback, AiJobInput  # noqa: E402

folder = ROOT / "fixtures" / "synthetic" / "ai-contracts"
job = json.loads((folder / "job-input.json").read_text(encoding="utf-8"))
callback = json.loads((folder / "callback.json").read_text(encoding="utf-8"))
AiJobInput.model_validate(job)
AiCallback.model_validate(callback)
try:
    AiCallback.model_validate({**callback, "decision": "APPROVED"})
except ValidationError:
    print("Pydantic: 2 valid fixtures passed; decision field rejected")
else:
    raise AssertionError("AI callback must not accept a decision field")
