-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "policy_products" (
    "id" UUID NOT NULL,
    "insurerId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL,
    "policyProductId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policy_products_insurerId_idx" ON "policy_products"("insurerId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_products_insurerId_code_key" ON "policy_products"("insurerId", "code");

-- CreateIndex
CREATE INDEX "policy_versions_policyProductId_status_effectiveFrom_effect_idx" ON "policy_versions"("policyProductId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_policyProductId_versionNumber_key" ON "policy_versions"("policyProductId", "versionNumber");

-- AddForeignKey
ALTER TABLE "policy_products" ADD CONSTRAINT "policy_products_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policyProductId_fkey" FOREIGN KEY ("policyProductId") REFERENCES "policy_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
