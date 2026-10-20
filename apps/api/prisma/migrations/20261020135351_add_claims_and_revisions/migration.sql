-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ANALYSING', 'NEEDS_INFORMATION', 'READY_FOR_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REFUSAL_PENDING', 'REFUSED', 'CLOSED');

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "originalReceiptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_revisions" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "intake" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_revisions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "claims"
ADD CONSTRAINT "claims_version_positive_check" CHECK ("version" > 0 AND "currentRevision" > 0),
ADD CONSTRAINT "draft_has_no_receipt_check" CHECK ("status" <> 'DRAFT' OR "originalReceiptAt" IS NULL);

ALTER TABLE "claim_revisions"
ADD CONSTRAINT "claim_revisions_number_positive_check" CHECK ("revisionNumber" > 0),
ADD CONSTRAINT "claim_revisions_intake_object_check" CHECK (jsonb_typeof("intake") = 'object');

-- CreateIndex
CREATE INDEX "claims_hospitalId_status_updatedAt_idx" ON "claims"("hospitalId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "claims_enrollmentId_idx" ON "claims"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "claim_revisions_claimId_revisionNumber_key" ON "claim_revisions"("claimId", "revisionNumber");

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "policy_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_revisions" ADD CONSTRAINT "claim_revisions_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Intake snapshots and the first receipt timestamp are permanent audit inputs.
CREATE FUNCTION "protect_claim_history"() RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'claim_revisions' THEN
        RAISE EXCEPTION 'claim revisions are immutable';
    END IF;
    IF OLD."originalReceiptAt" IS NOT NULL
       AND NEW."originalReceiptAt" IS DISTINCT FROM OLD."originalReceiptAt" THEN
        RAISE EXCEPTION 'original receipt timestamp is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "claim_revisions_immutable_trigger"
BEFORE UPDATE OR DELETE ON "claim_revisions"
FOR EACH ROW EXECUTE FUNCTION "protect_claim_history"();

CREATE TRIGGER "claims_receipt_immutable_trigger"
BEFORE UPDATE ON "claims"
FOR EACH ROW EXECUTE FUNCTION "protect_claim_history"();
