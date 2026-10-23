"""Python mirror of packages/contracts/src/ai-job.ts. No database access here."""

from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AiDocumentRef(StrictModel):
    document_id: UUID
    version_id: UUID
    type: Literal[
        "PREAUTH_FORM", "MEMBER_PROOF", "CLINICAL_NOTE", "INVESTIGATION_REPORT",
        "TREATMENT_PLAN", "ESTIMATE", "CONSENT", "OTHER",
    ]
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    object_key: str = Field(min_length=1)


class AiJobInput(StrictModel):
    job_id: UUID
    claim_id: UUID
    claim_revision: int = Field(gt=0)
    attempt_generation: int = Field(gt=0)
    lease_token: UUID
    document_set_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    original_receipt_at: AwareDatetime
    enrollment_id: UUID
    member_id: UUID
    policy_version_id: UUID
    addon_version_ids: list[UUID]
    documents: list[AiDocumentRef]


class AiEvidence(StrictModel):
    source_kind: Literal["DOCUMENT", "POLICY_CLAUSE", "CHECKLIST_RULE"]
    source_id: UUID
    page: int = Field(gt=0)
    quote: str = Field(min_length=1, max_length=500)


class AiFinding(StrictModel):
    kind: Literal["DOCUMENT_GAP", "CLINICAL_UNCERTAINTY", "POLICY_CHECK"]
    summary: str = Field(min_length=1, max_length=500)
    evidence: list[AiEvidence] = Field(min_length=1)


class AiStageResult(StrictModel):
    name: str = Field(min_length=1)
    status: Literal["succeeded", "partial", "failed", "skipped", "reused"]


class AiCallback(StrictModel):
    job_id: UUID
    claim_id: UUID
    claim_revision: int = Field(gt=0)
    attempt_generation: int = Field(gt=0)
    lease_token: UUID
    document_set_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    status: Literal["SUCCEEDED", "PARTIAL", "FAILED"]
    stages: list[AiStageResult]
    findings: list[AiFinding]
    error_code: str | None = Field(pattern=r"^[A-Z_]{1,80}$")
