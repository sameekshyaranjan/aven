CREATE TYPE "AiJobKind" AS ENUM ('CLAIM_ANALYSIS');
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'MANUAL_REVIEW');
CREATE TYPE "AiAttemptStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "claimRevisionId" UUID NOT NULL,
    "policyVersionId" UUID NOT NULL,
    "addonVersionIds" JSONB NOT NULL,
    "documentSetHash" VARCHAR(64) NOT NULL,
    "kind" "AiJobKind" NOT NULL DEFAULT 'CLAIM_ANALYSIS',
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptGeneration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_job_attempts" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" "AiAttemptStatus" NOT NULL DEFAULT 'RUNNING',
    "leaseToken" UUID,
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "ai_job_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_jobs_claimRevisionId_kind_key" ON "ai_jobs"("claimRevisionId", "kind");
CREATE INDEX "ai_jobs_status_createdAt_idx" ON "ai_jobs"("status", "createdAt");
CREATE INDEX "ai_jobs_claimId_createdAt_idx" ON "ai_jobs"("claimId", "createdAt");
CREATE UNIQUE INDEX "ai_job_attempts_leaseToken_key" ON "ai_job_attempts"("leaseToken");
CREATE UNIQUE INDEX "ai_job_attempts_jobId_generation_key" ON "ai_job_attempts"("jobId", "generation");

ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_claimRevisionId_fkey" FOREIGN KEY ("claimRevisionId") REFERENCES "claim_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_job_attempts" ADD CONSTRAINT "ai_job_attempts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ai_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
