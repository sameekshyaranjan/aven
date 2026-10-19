-- The supplied T&C files do not state that their filename dates are policy
-- validity dates. Version IDs provide the source boundary, so these inferred
-- temporal columns are removed rather than storing unsupported meaning.

DROP INDEX "policy_versions_policyProductId_status_effectiveFrom_effect_idx";
DROP INDEX "addon_versions_insurerId_status_effectiveFrom_effectiveTo_idx";
DROP INDEX "policy_rule_versions_policyVersionId_addonVersionId_ruleTyp_idx";

ALTER TABLE "policy_versions"
DROP CONSTRAINT "policy_versions_effective_date_order_check",
DROP COLUMN "effectiveFrom",
DROP COLUMN "effectiveTo";

ALTER TABLE "addon_versions"
DROP COLUMN "effectiveFrom",
DROP COLUMN "effectiveTo";

ALTER TABLE "policy_rule_versions"
DROP CONSTRAINT "policy_rule_versions_effective_date_order_check",
DROP COLUMN "effectiveFrom",
DROP COLUMN "effectiveTo";

CREATE INDEX "policy_versions_policyProductId_status_idx"
ON "policy_versions"("policyProductId", "status");

CREATE INDEX "addon_versions_insurerId_status_idx"
ON "addon_versions"("insurerId", "status");

CREATE INDEX "policy_rule_versions_policyVersionId_addonVersionId_ruleTyp_idx"
ON "policy_rule_versions"("policyVersionId", "addonVersionId", "ruleType");
