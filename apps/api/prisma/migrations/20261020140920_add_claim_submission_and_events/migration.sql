-- AlterTable
ALTER TABLE "claims" ADD COLUMN     "emergencyReason" VARCHAR(500),
ADD COLUMN     "missingAtSubmission" JSONB;

-- CreateTable
CREATE TABLE "claim_events" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "actorUserId" UUID,
    "fromStatus" "ClaimStatus" NOT NULL,
    "toStatus" "ClaimStatus" NOT NULL,
    "claimVersion" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "claim_events_claimId_createdAt_idx" ON "claim_events"("claimId", "createdAt");

-- AddForeignKey
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
