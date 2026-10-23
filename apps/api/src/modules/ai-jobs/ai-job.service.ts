import { createHash, randomUUID } from 'node:crypto';
import { AiJobInputSchema, AiJobStatusViewSchema, type AiCallback } from '@aven/contracts';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError } from '../../errors/app-error';
import { documentSetHash } from './document-set';

const maxAttempts = env.JOB_MAX_RETRIES + 1;
const retryable = new Set([
  'PROVIDER_UNAVAILABLE',
  'TIMEOUT',
  'NETWORK_ERROR',
  'TEMPORARY_STORAGE_ERROR',
]);
type JobWithClaim = Prisma.AiJobGetPayload<{ include: { claim: true; claimRevision: true } }>;

async function currentInput(tx: Prisma.TransactionClient, job: JobWithClaim) {
  const enrollment = await tx.policyEnrollment.findUniqueOrThrow({
    where: { id: job.claim.enrollmentId },
    select: { policyVersionId: true, selectedAddons: { select: { addonVersionId: true } } },
  });
  const addons = enrollment.selectedAddons.map((item) => item.addonVersionId).sort();
  return (
    job.claim.status !== 'DRAFT' &&
    job.claim.originalReceiptAt !== null &&
    job.claim.currentRevision === job.claimRevision.revisionNumber &&
    job.claim.version === job.claimVersion &&
    enrollment.policyVersionId === job.policyVersionId &&
    JSON.stringify(addons) === JSON.stringify(job.addonVersionIds) &&
    (await documentSetHash(tx, job.claimId)) === job.documentSetHash
  );
}

/** Lock one queue row, then create its lease before releasing the transaction. */
export async function claimNextJob() {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string }[]>`
      SELECT job.id FROM ai_jobs AS job
      WHERE job.status = 'QUEUED'
         OR (job.status = 'RUNNING' AND EXISTS (
           SELECT 1 FROM ai_job_attempts AS attempt
           WHERE attempt."jobId" = job.id
             AND attempt.generation = job."attemptGeneration"
             AND attempt.status = 'RUNNING'
             AND attempt."leaseExpiresAt" <= NOW()
         ))
      ORDER BY job."createdAt", job.id
      LIMIT 1 FOR UPDATE OF job SKIP LOCKED
    `;
    if (!row) return null;
    const job = await tx.aiJob.findUniqueOrThrow({
      where: { id: row.id },
      include: { claim: true, claimRevision: true },
    });
    if (!(await currentInput(tx, job))) {
      await tx.aiJob.update({ where: { id: job.id }, data: { status: 'SUPERSEDED' } });
      return null;
    }
    if (job.attemptGeneration >= maxAttempts) {
      await tx.aiJob.update({
        where: { id: job.id },
        data: { status: 'MANUAL_REVIEW', lastErrorCode: 'LEASE_EXPIRED' },
      });
      return null;
    }
    if (job.status === 'RUNNING') {
      await tx.aiJobAttempt.updateMany({
        where: { jobId: job.id, generation: job.attemptGeneration, status: 'RUNNING' },
        data: { status: 'EXPIRED', finishedAt: new Date(), errorCode: 'LEASE_EXPIRED' },
      });
    }
    const generation = job.attemptGeneration + 1;
    const leaseToken = randomUUID();
    await tx.aiJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', attemptGeneration: generation, currentStage: 'claimed' },
    });
    await tx.aiJobAttempt.create({
      data: {
        jobId: job.id,
        generation,
        leaseToken,
        leaseExpiresAt: new Date(Date.now() + env.JOB_LEASE_DURATION_SECONDS * 1000),
      },
    });
    const documents = await tx.document.findMany({
      where: { claimId: job.claimId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        type: true,
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { id: true, sha256: true, objectKey: true },
        },
      },
    });
    return AiJobInputSchema.parse({
      job_id: job.id,
      claim_id: job.claimId,
      claim_revision: job.claimRevision.revisionNumber,
      attempt_generation: generation,
      lease_token: leaseToken,
      document_set_hash: job.documentSetHash,
      original_receipt_at: job.claim.originalReceiptAt!.toISOString(),
      enrollment_id: job.claim.enrollmentId,
      member_id: job.claim.memberId,
      policy_version_id: job.policyVersionId,
      addon_version_ids: job.addonVersionIds,
      documents: documents.map((document) => ({
        document_id: document.id,
        version_id: document.versions[0]?.id,
        type: document.type,
        sha256: document.versions[0]?.sha256,
        object_key: document.versions[0]?.objectKey,
      })),
    });
  });
}

export async function heartbeat(jobId: string, generation: number, token: string, stage: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ai_jobs WHERE id = ${jobId}::uuid FOR UPDATE`;
    const job = await tx.aiJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'RUNNING' || job.attemptGeneration !== generation)
      throw new ConflictError('This AI attempt is no longer current.');
    const changed = await tx.aiJobAttempt.updateMany({
      where: {
        jobId,
        generation,
        leaseToken: token,
        status: 'RUNNING',
        leaseExpiresAt: { gt: new Date() },
      },
      data: { leaseExpiresAt: new Date(Date.now() + env.JOB_LEASE_DURATION_SECONDS * 1000) },
    });
    if (changed.count !== 1) throw new ConflictError('This AI lease has expired.');
    await tx.aiJob.update({ where: { id: jobId }, data: { currentStage: stage } });
    return { accepted: true };
  });
}

export async function acceptCallback(callback: AiCallback) {
  const hash = createHash('sha256').update(JSON.stringify(callback)).digest('hex');
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ai_jobs WHERE id = ${callback.job_id}::uuid FOR UPDATE`;
    const job = await tx.aiJob.findUnique({
      where: { id: callback.job_id },
      include: { claim: true, claimRevision: true },
    });
    if (!job) throw new NotFoundError('AI job was not found.');
    const attempt = await tx.aiJobAttempt.findUnique({
      where: { jobId_generation: { jobId: job.id, generation: callback.attempt_generation } },
    });
    if (attempt?.callbackHash === hash)
      return {
        accepted: true,
        replayed: true,
        status:
          attempt.status === 'FAILED'
            ? retryable.has(attempt.errorCode ?? '') && attempt.generation < maxAttempts
              ? 'QUEUED'
              : 'MANUAL_REVIEW'
            : attempt.status === 'PARTIAL'
              ? 'PARTIAL'
              : 'SUCCEEDED',
      };
    if (attempt?.callbackHash) throw new ConflictError('This AI attempt already has a result.');
    if (
      job.claimId !== callback.claim_id ||
      job.claimRevision.revisionNumber !== callback.claim_revision ||
      job.documentSetHash !== callback.document_set_hash ||
      job.status !== 'RUNNING' ||
      job.attemptGeneration !== callback.attempt_generation ||
      attempt?.status !== 'RUNNING' ||
      attempt.leaseToken !== callback.lease_token ||
      !attempt.leaseExpiresAt ||
      attempt.leaseExpiresAt <= new Date()
    )
      throw new ConflictError('This AI result is stale.');
    await tx.$queryRaw`SELECT id FROM claims WHERE id = ${job.claimId}::uuid FOR UPDATE`;
    const freshJob = await tx.aiJob.findUniqueOrThrow({
      where: { id: job.id },
      include: { claim: true, claimRevision: true },
    });
    if (!(await currentInput(tx, freshJob))) {
      await tx.aiJob.update({ where: { id: job.id }, data: { status: 'SUPERSEDED' } });
      await tx.aiJobAttempt.update({
        where: { id: attempt.id },
        data: { status: 'EXPIRED', finishedAt: new Date() },
      });
      return { accepted: false, replayed: false, status: 'SUPERSEDED' as const };
    }
    const errorCode =
      callback.status === 'FAILED' ? (callback.error_code ?? 'UNKNOWN_FAILURE') : null;
    const status =
      callback.status === 'FAILED'
        ? retryable.has(errorCode!) && job.attemptGeneration < maxAttempts
          ? 'QUEUED'
          : 'MANUAL_REVIEW'
        : callback.status === 'PARTIAL'
          ? 'PARTIAL'
          : 'SUCCEEDED';
    await tx.aiJobAttempt.update({
      where: { id: attempt.id },
      data: {
        status:
          callback.status === 'FAILED'
            ? 'FAILED'
            : callback.status === 'PARTIAL'
              ? 'PARTIAL'
              : 'SUCCEEDED',
        finishedAt: new Date(),
        errorCode,
        callbackHash: hash,
      },
    });
    await tx.aiJob.update({
      where: { id: job.id },
      data: {
        status,
        currentStage: callback.stages.at(-1)?.name ?? job.currentStage,
        lastErrorCode: errorCode,
        result: callback as Prisma.InputJsonValue,
      },
    });
    return { accepted: true, replayed: false, status };
  });
  if (!outcome.accepted) throw new ConflictError('This AI result is stale.');
  return outcome;
}

export async function reviewerJobStatus(claimId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, status: { not: 'DRAFT' } },
    select: { id: true },
  });
  if (!claim) throw new NotFoundError('Claim was not found.');
  const job = await prisma.aiJob.findFirst({
    where: { claimId },
    orderBy: { createdAt: 'desc' },
    include: { attempts: { orderBy: { generation: 'desc' }, take: 1 } },
  });
  if (!job) return null;
  const expired =
    job.status === 'RUNNING' &&
    Boolean(job.attempts[0]?.leaseExpiresAt && job.attempts[0].leaseExpiresAt <= new Date());
  return AiJobStatusViewSchema.parse({
    status: job.status,
    stage: job.currentStage,
    attempt: job.attemptGeneration,
    maxAttempts,
    retryAvailable:
      (job.status === 'QUEUED' && job.attemptGeneration > 0) ||
      (expired && job.attemptGeneration < maxAttempts),
    degraded: ['PARTIAL', 'FAILED', 'MANUAL_REVIEW', 'SUPERSEDED'].includes(job.status) || expired,
    errorCode: expired ? 'LEASE_EXPIRED' : job.lastErrorCode,
    updatedAt: job.updatedAt.toISOString(),
  });
}
