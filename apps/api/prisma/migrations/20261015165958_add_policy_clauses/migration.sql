-- CreateTable
CREATE TABLE "policy_clauses" (
    "id" UUID NOT NULL,
    "policyVersionId" UUID NOT NULL,
    "addonVersionId" UUID,
    "clauseId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "pageLabel" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policy_clauses_policyVersionId_addonVersionId_idx" ON "policy_clauses"("policyVersionId", "addonVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_clauses_clauseId_versionNumber_key" ON "policy_clauses"("clauseId", "versionNumber");

-- AddForeignKey
ALTER TABLE "policy_clauses" ADD CONSTRAINT "policy_clauses_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_clauses" ADD CONSTRAINT "policy_clauses_addonVersionId_fkey" FOREIGN KEY ("addonVersionId") REFERENCES "addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
