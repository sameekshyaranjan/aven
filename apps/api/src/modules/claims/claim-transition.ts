import type { Claim, ClaimStatus, Prisma } from '@prisma/client';
import { ConflictError, ForbiddenError, ValidationError } from '../../errors/app-error';
import type { AuthenticatedActor } from '../auth/auth.types';
import { requireHospitalId } from '../auth/hospital-scope';
import type { ClaimIntake } from '@aven/contracts';
import { documentSetHash } from '../ai-jobs/document-set';

const ALLOWED: Partial<Record<ClaimStatus, ClaimStatus[]>> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['ANALYSING', 'NEEDS_INFORMATION', 'CLOSED'],
  ANALYSING: ['NEEDS_INFORMATION', 'READY_FOR_REVIEW', 'CLOSED'],
  NEEDS_INFORMATION: ['ANALYSING', 'READY_FOR_REVIEW', 'CLOSED'],
  READY_FOR_REVIEW: [
    'UNDER_REVIEW',
    'NEEDS_INFORMATION',
    'APPROVED',
    'PARTIALLY_APPROVED',
    'REFUSAL_PENDING',
    'CLOSED',
  ],
  UNDER_REVIEW: [
    'READY_FOR_REVIEW',
    'NEEDS_INFORMATION',
    'APPROVED',
    'PARTIALLY_APPROVED',
    'REFUSAL_PENDING',
    'CLOSED',
  ],
  REFUSAL_PENDING: ['REFUSED', 'READY_FOR_REVIEW', 'CLOSED'],
};

export function assertClaimTransition(
  from: ClaimStatus,
  to: ClaimStatus,
  role: AuthenticatedActor['role'] | 'SYSTEM',
): void {
  if (!ALLOWED[from]?.includes(to)) {
    throw new ValidationError(
      'This claim status change is not allowed.',
      undefined,
      'ILLEGAL_TRANSITION',
    );
  }
  if (to === 'SUBMITTED' && role !== 'HOSPITAL_DESK') throw new ForbiddenError();
  if (to === 'ANALYSING' && role !== 'SYSTEM') throw new ForbiddenError();
  if (
    ['APPROVED', 'PARTIALLY_APPROVED', 'REFUSAL_PENDING', 'REFUSED', 'UNDER_REVIEW'].includes(to) &&
    role !== 'INSURER_REVIEWER'
  )
    throw new ForbiddenError();
  if (to === 'CLOSED' && role !== 'INSURER_REVIEWER' && role !== 'ADMIN')
    throw new ForbiddenError();
  if (
    to === 'NEEDS_INFORMATION' &&
    (from === 'ANALYSING' ? role !== 'SYSTEM' : role !== 'INSURER_REVIEWER' && role !== 'ADMIN')
  )
    throw new ForbiddenError();
  if (to === 'READY_FOR_REVIEW' && from === 'ANALYSING' && role !== 'SYSTEM')
    throw new ForbiddenError();
  if (
    to === 'READY_FOR_REVIEW' &&
    (from === 'REFUSAL_PENDING' || from === 'UNDER_REVIEW') &&
    role !== 'INSURER_REVIEWER'
  )
    throw new ForbiddenError();
  if (
    to === 'READY_FOR_REVIEW' &&
    from === 'NEEDS_INFORMATION' &&
    role !== 'INSURER_REVIEWER' &&
    role !== 'HOSPITAL_DESK' &&
    role !== 'SYSTEM'
  )
    throw new ForbiddenError();
}

/** The only live transition today. Later workflows must add their own guards here. */
export async function submitTransition(
  tx: Prisma.TransactionClient,
  claim: Claim,
  actor: AuthenticatedActor,
  intake: ClaimIntake,
  missingFields: string[],
  emergencyReason?: string,
): Promise<Claim> {
  assertClaimTransition(claim.status, 'SUBMITTED', actor.role);
  const changed = await tx.claim.updateMany({
    where: {
      id: claim.id,
      hospitalId: requireHospitalId(actor),
      status: 'DRAFT',
      version: claim.version,
    },
    data: {
      status: 'SUBMITTED',
      version: { increment: 1 },
      currentRevision: { increment: 1 },
      originalReceiptAt: new Date(),
      emergencyReason: emergencyReason ?? null,
      missingAtSubmission: missingFields,
    },
  });
  if (changed.count !== 1)
    throw new ConflictError('This draft has changed. Reload it before submitting.');

  const revision = await tx.claimRevision.create({
    data: { claimId: claim.id, revisionNumber: claim.currentRevision + 1, intake },
  });
  const enrollment = await tx.policyEnrollment.findUniqueOrThrow({
    where: { id: claim.enrollmentId },
    select: { policyVersionId: true, selectedAddons: { select: { addonVersionId: true } } },
  });
  const hash = await documentSetHash(tx, claim.id);
  await tx.aiJob.create({
    data: {
      claimId: claim.id,
      claimRevisionId: revision.id,
      claimVersion: claim.version + 1,
      policyVersionId: enrollment.policyVersionId,
      addonVersionIds: enrollment.selectedAddons.map((item) => item.addonVersionId).sort(),
      documentSetHash: hash,
    },
  });
  await tx.claimEvent.create({
    data: {
      claimId: claim.id,
      actorUserId: actor.userId,
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
      claimVersion: claim.version + 1,
      reason: emergencyReason,
    },
  });
  const reviewers = await tx.user.findMany({
    where: { role: 'INSURER_REVIEWER', isActive: true },
    select: { id: true },
  });
  if (reviewers.length)
    await tx.notification.createMany({
      data: reviewers.map((user) => ({
        userId: user.id,
        claimId: claim.id,
        title: 'New claim submitted for review',
      })),
    });
  return tx.claim.findUniqueOrThrow({ where: { id: claim.id } });
}
