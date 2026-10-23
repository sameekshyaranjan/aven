-- CreateEnum
CREATE TYPE "ReviewActionKind" AS ENUM ('NOTE', 'CONFIRM', 'FLAG');

-- CreateEnum
CREATE TYPE "InformationRequestStatus" AS ENUM ('OPEN', 'RESPONSE_RECEIVED');

-- CreateTable
CREATE TABLE "review_actions" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "kind" "ReviewActionKind" NOT NULL,
    "fieldKey" VARCHAR(100),
    "text" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "information_requests" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "status" "InformationRequestStatus" NOT NULL DEFAULT 'OPEN',
    "items" JSONB NOT NULL,
    "publishedRevision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "information_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "information_responses" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "hospitalUserId" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "documentIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "information_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_actions_claimId_createdAt_idx" ON "review_actions"("claimId", "createdAt");

-- CreateIndex
CREATE INDEX "information_requests_claimId_status_createdAt_idx" ON "information_requests"("claimId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "information_responses_requestId_key" ON "information_responses"("requestId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_responses" ADD CONSTRAINT "information_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "information_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_responses" ADD CONSTRAINT "information_responses_hospitalUserId_fkey" FOREIGN KEY ("hospitalUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
