ALTER TABLE "documents"
ADD CONSTRAINT "documents_current_version_positive_check" CHECK ("currentVersion" > 0);

ALTER TABLE "document_versions"
ADD CONSTRAINT "document_versions_content_check"
CHECK ("version" > 0 AND "sizeBytes" > 0 AND length("sha256") = 64);

-- Processing status can change; the file identity and upload evidence cannot.
CREATE FUNCTION "protect_document_version_content"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'document versions cannot be deleted';
  END IF;
  IF ROW(OLD."documentId", OLD."version", OLD."objectKey", OLD."sha256",
         OLD."sizeBytes", OLD."mediaType", OLD."uploadedByUserId",
         OLD."replacementReason", OLD."createdAt")
     IS DISTINCT FROM
     ROW(NEW."documentId", NEW."version", NEW."objectKey", NEW."sha256",
         NEW."sizeBytes", NEW."mediaType", NEW."uploadedByUserId",
         NEW."replacementReason", NEW."createdAt") THEN
    RAISE EXCEPTION 'document version content is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_versions_content_immutable_trigger"
BEFORE UPDATE OR DELETE ON "document_versions"
FOR EACH ROW EXECUTE FUNCTION "protect_document_version_content"();
