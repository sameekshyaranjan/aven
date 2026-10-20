-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PREAUTH_FORM', 'MEMBER_PROOF', 'CLINICAL_NOTE', 'INVESTIGATION_REPORT', 'TREATMENT_PLAN', 'ESTIMATE', 'CONSENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'READY', 'ANALYSING', 'ANALYSED', 'UNREADABLE', 'FAILED');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mediaType" VARCHAR(100) NOT NULL,
    "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'READY',
    "uploadedByUserId" UUID NOT NULL,
    "replacementReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_claimId_createdAt_idx" ON "documents"("claimId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_objectKey_key" ON "document_versions"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "document_versions"("documentId", "version");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
