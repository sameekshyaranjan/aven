-- CreateTable
CREATE TABLE "policy_enrollments" (
    "id" UUID NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "policyVersionId" UUID NOT NULL,
    "coverageStart" DATE NOT NULL,
    "coverageEnd" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_enrollments_policyNumber_key" ON "policy_enrollments"("policyNumber");

-- CreateIndex
CREATE INDEX "policy_enrollments_policyVersionId_coverageStart_coverageEn_idx" ON "policy_enrollments"("policyVersionId", "coverageStart", "coverageEnd");

-- Coverage cannot end before it starts.
ALTER TABLE "policy_enrollments"
ADD CONSTRAINT "policy_enrollments_coverage_dates_check"
CHECK ("coverageEnd" >= "coverageStart");

-- AddForeignKey
ALTER TABLE "policy_enrollments" ADD CONSTRAINT "policy_enrollments_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
