-- CreateEnum
CREATE TYPE "PolicyRuleType" AS ENUM ('WAITING_PERIOD', 'CHECKLIST_APPLICABILITY', 'ADDON_PRECEDENCE');

-- CreateTable
CREATE TABLE "policy_rule_versions" (
    "id" UUID NOT NULL,
    "policyVersionId" UUID NOT NULL,
    "addonVersionId" UUID,
    "ruleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "ruleType" "PolicyRuleType" NOT NULL,
    "parameters" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_rule_clauses" (
    "ruleVersionId" UUID NOT NULL,
    "policyClauseId" UUID NOT NULL,

    CONSTRAINT "policy_rule_clauses_pkey" PRIMARY KEY ("ruleVersionId","policyClauseId")
);

-- CreateIndex
CREATE INDEX "policy_rule_versions_policyVersionId_addonVersionId_ruleTyp_idx" ON "policy_rule_versions"("policyVersionId", "addonVersionId", "ruleType", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "policy_rule_versions_ruleId_versionNumber_key" ON "policy_rule_versions"("ruleId", "versionNumber");

-- CreateIndex
CREATE INDEX "policy_rule_clauses_policyClauseId_idx" ON "policy_rule_clauses"("policyClauseId");

-- AddForeignKey
ALTER TABLE "policy_rule_versions" ADD CONSTRAINT "policy_rule_versions_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_rule_versions" ADD CONSTRAINT "policy_rule_versions_addonVersionId_fkey" FOREIGN KEY ("addonVersionId") REFERENCES "addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_rule_clauses" ADD CONSTRAINT "policy_rule_clauses_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "policy_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_rule_clauses" ADD CONSTRAINT "policy_rule_clauses_policyClauseId_fkey" FOREIGN KEY ("policyClauseId") REFERENCES "policy_clauses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rule versions use positive version numbers, non-negative priority, object
-- parameters and a valid inclusive effective-date range.
ALTER TABLE "policy_rule_versions"
ADD CONSTRAINT "policy_rule_versions_version_number_positive_check"
CHECK ("versionNumber" > 0),
ADD CONSTRAINT "policy_rule_versions_priority_non_negative_check"
CHECK ("priority" >= 0),
ADD CONSTRAINT "policy_rule_versions_parameters_object_check"
CHECK (jsonb_typeof("parameters") = 'object'),
ADD CONSTRAINT "policy_rule_versions_effective_date_order_check"
CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");

-- A calculation must always be reproducible from the exact rule version and
-- clause links originally selected. Corrections require a new version.
CREATE FUNCTION "reject_policy_rule_config_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'policy rule configuration is immutable; create a new version instead'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "policy_rule_versions_immutable_trigger"
BEFORE UPDATE OR DELETE ON "policy_rule_versions"
FOR EACH ROW
EXECUTE FUNCTION "reject_policy_rule_config_mutation"();

CREATE TRIGGER "policy_rule_clauses_immutable_trigger"
BEFORE UPDATE OR DELETE ON "policy_rule_clauses"
FOR EACH ROW
EXECUTE FUNCTION "reject_policy_rule_config_mutation"();
