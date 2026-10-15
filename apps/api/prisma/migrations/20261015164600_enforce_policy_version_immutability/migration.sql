-- Policy versions start at 1 and use a valid inclusive effective-date range.
ALTER TABLE "policy_versions"
ADD CONSTRAINT "policy_versions_version_number_positive_check"
CHECK ("versionNumber" > 0),
ADD CONSTRAINT "policy_versions_effective_date_order_check"
CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");

-- The fixed reviewed wording is append-only. Corrections require a new row and
-- must never rewrite or delete the version already referenced by a claim.
CREATE FUNCTION "reject_policy_version_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'policy versions are immutable; create a new version instead'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "policy_versions_immutable_trigger"
BEFORE UPDATE OR DELETE ON "policy_versions"
FOR EACH ROW
EXECUTE FUNCTION "reject_policy_version_mutation"();
