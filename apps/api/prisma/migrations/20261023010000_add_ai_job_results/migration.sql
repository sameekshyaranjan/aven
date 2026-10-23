ALTER TYPE "AiJobStatus" ADD VALUE 'PARTIAL';
ALTER TYPE "AiJobStatus" ADD VALUE 'SUPERSEDED';
ALTER TYPE "AiAttemptStatus" ADD VALUE 'PARTIAL';

ALTER TABLE "ai_jobs" ADD COLUMN "claimVersion" INTEGER,
ADD COLUMN "currentStage" VARCHAR(80),
ADD COLUMN "lastErrorCode" VARCHAR(80),
ADD COLUMN "result" JSONB;

ALTER TABLE "ai_job_attempts" ADD COLUMN "errorCode" VARCHAR(80),
ADD COLUMN "callbackHash" VARCHAR(64);

UPDATE "ai_jobs" AS job SET "claimVersion" = COALESCE(
  (SELECT MAX(event."claimVersion") FROM "claim_events" AS event
   WHERE event."claimId" = job."claimId" AND event."toStatus" = 'SUBMITTED'),
  (SELECT claim."version" FROM "claims" AS claim WHERE claim."id" = job."claimId")
);
ALTER TABLE "ai_jobs" ALTER COLUMN "claimVersion" SET NOT NULL;
