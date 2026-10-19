-- CreateEnum
CREATE TYPE "MemberRelationship" AS ENUM ('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER');

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "memberCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "relationship" "MemberRelationship" NOT NULL,
    "isPolicyholder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_enrollment_addons" (
    "enrollmentId" UUID NOT NULL,
    "addonVersionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_enrollment_addons_pkey" PRIMARY KEY ("enrollmentId","addonVersionId")
);

-- CreateIndex
CREATE INDEX "members_enrollmentId_idx" ON "members"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "members_enrollmentId_memberCode_key" ON "members"("enrollmentId", "memberCode");

-- Each policy enrollment can identify at most one covered member as the policyholder.
CREATE UNIQUE INDEX "members_one_policyholder_per_enrollment_key"
ON "members"("enrollmentId")
WHERE "isPolicyholder" = true;

-- CreateIndex
CREATE INDEX "policy_enrollment_addons_addonVersionId_idx" ON "policy_enrollment_addons"("addonVersionId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "policy_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_enrollment_addons" ADD CONSTRAINT "policy_enrollment_addons_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "policy_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_enrollment_addons" ADD CONSTRAINT "policy_enrollment_addons_addonVersionId_fkey" FOREIGN KEY ("addonVersionId") REFERENCES "addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
