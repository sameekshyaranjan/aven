-- CreateEnum
CREATE TYPE "AddonVersionStatus" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "addon_versions" (
    "id" UUID NOT NULL,
    "insurerId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AddonVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addon_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_addon_compatibilities" (
    "policyVersionId" UUID NOT NULL,
    "addonVersionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_addon_compatibilities_pkey" PRIMARY KEY ("policyVersionId","addonVersionId")
);

-- CreateIndex
CREATE INDEX "addon_versions_insurerId_status_effectiveFrom_effectiveTo_idx" ON "addon_versions"("insurerId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "addon_versions_insurerId_code_versionNumber_key" ON "addon_versions"("insurerId", "code", "versionNumber");

-- CreateIndex
CREATE INDEX "policy_addon_compatibilities_addonVersionId_idx" ON "policy_addon_compatibilities"("addonVersionId");

-- AddForeignKey
ALTER TABLE "addon_versions" ADD CONSTRAINT "addon_versions_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_addon_compatibilities" ADD CONSTRAINT "policy_addon_compatibilities_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_addon_compatibilities" ADD CONSTRAINT "policy_addon_compatibilities_addonVersionId_fkey" FOREIGN KEY ("addonVersionId") REFERENCES "addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
