-- Clause versions start at 1.
ALTER TABLE "policy_clauses"
ADD CONSTRAINT "policy_clauses_version_number_positive_check"
CHECK ("versionNumber" > 0);

-- Citations must keep pointing to the exact wording that was reviewed.
-- Corrections require a new clause-version row.
CREATE FUNCTION "reject_policy_clause_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'policy clauses are immutable; create a new version instead'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "policy_clauses_immutable_trigger"
BEFORE UPDATE OR DELETE ON "policy_clauses"
FOR EACH ROW
EXECUTE FUNCTION "reject_policy_clause_mutation"();
