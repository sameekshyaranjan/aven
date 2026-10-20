import {
  ClaimIntakeSchema,
  DraftClaimSchema,
  HospitalClaimSchema,
  buildPaginationMeta,
  type ClaimIntake,
  type DraftClaim,
  type HospitalClaim,
  type ClaimListQuery,
} from '@aven/contracts';
import type { Claim, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/app-error';
import { requireHospitalId, withHospitalScope } from '../auth/hospital-scope';
import type { AuthenticatedActor } from '../auth/auth.types';
import { evaluateClaimCompleteness } from './claim-completeness';
import { assertClaimTransition, submitTransition } from './claim-transition';

function draftResponse(claim: Claim, intake: ClaimIntake): DraftClaim {
  return DraftClaimSchema.parse({
    id: claim.id,
    memberId: claim.memberId,
    status: claim.status,
    version: claim.version,
    revision: claim.currentRevision,
    intake,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  });
}

function hospitalResponse(claim: Claim, intake: ClaimIntake): HospitalClaim {
  return HospitalClaimSchema.parse({
    id: claim.id,
    memberId: claim.memberId,
    status: claim.status,
    version: claim.version,
    revision: claim.currentRevision,
    intake,
    originalReceiptAt: claim.originalReceiptAt?.toISOString() ?? null,
    emergencyReason: claim.emergencyReason,
    missingAtSubmission: claim.missingAtSubmission ?? [],
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  });
}

/** Draft creation never starts the original receipt clock. */
export async function createDraftClaim(
  actor: AuthenticatedActor,
  enrollmentId: string,
  memberId: string,
  intake: ClaimIntake,
): Promise<DraftClaim> {
  const hospitalId = requireHospitalId(actor);
  const member = await prisma.member.findFirst({
    where: { id: memberId, enrollmentId },
    select: { id: true },
  });
  if (!member) {
    throw new ValidationError('The selected member does not belong to this enrollment.');
  }

  const claim = await prisma.claim.create({
    data: {
      hospitalId,
      enrollmentId,
      memberId,
      revisions: { create: { revisionNumber: 1, intake } },
      events: {
        create: { actor: { connect: { id: actor.userId } }, toStatus: 'DRAFT', claimVersion: 1 },
      },
    },
  });
  return draftResponse(claim, intake);
}

export async function getHospitalClaim(
  actor: AuthenticatedActor,
  claimId: string,
): Promise<HospitalClaim> {
  const claim = await prisma.claim.findFirst({
    where: withHospitalScope(actor, { id: claimId }),
    include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
  });
  if (!claim || !claim.revisions[0]) {
    throw new NotFoundError('Claim was not found.');
  }
  return hospitalResponse(claim, ClaimIntakeSchema.parse(claim.revisions[0].intake));
}

/** Replace the form only if the caller edited the latest draft version. */
export async function updateDraftClaim(
  actor: AuthenticatedActor,
  claimId: string,
  expectedVersion: number,
  intake: ClaimIntake,
): Promise<DraftClaim> {
  const hospitalId = requireHospitalId(actor);

  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findFirst({
      where: { id: claimId, hospitalId, status: 'DRAFT' },
    });
    if (!claim) throw new NotFoundError('Draft claim was not found.');
    if (claim.version !== expectedVersion) {
      throw new ConflictError('This draft has changed. Reload it before saving.');
    }

    const updated = await tx.claim.updateMany({
      where: { id: claimId, hospitalId, status: 'DRAFT', version: expectedVersion },
      data: { version: { increment: 1 }, currentRevision: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new ConflictError('This draft has changed. Reload it before saving.');
    }

    await tx.claimRevision.create({
      data: { claimId, revisionNumber: claim.currentRevision + 1, intake },
    });
    const saved = await tx.claim.findUniqueOrThrow({ where: { id: claimId } });
    return draftResponse(saved, intake);
  });
}

export async function getClaimCompleteness(actor: AuthenticatedActor, claimId: string) {
  const claim = await prisma.claim.findFirst({
    where: withHospitalScope(actor, { id: claimId, status: 'DRAFT' as const }),
    include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
  });
  if (!claim || !claim.revisions[0]) throw new NotFoundError('Draft claim was not found.');
  return evaluateClaimCompleteness(ClaimIntakeSchema.parse(claim.revisions[0].intake));
}

export async function submitClaim(
  actor: AuthenticatedActor,
  claimId: string,
  expectedVersion: number,
  emergencyReason?: string,
): Promise<HospitalClaim> {
  const hospitalId = requireHospitalId(actor);
  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findFirst({
      where: { id: claimId, hospitalId },
      include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
    });
    if (!claim || !claim.revisions[0]) throw new NotFoundError('Draft claim was not found.');
    assertClaimTransition(claim.status, 'SUBMITTED', actor.role);
    if (claim.version !== expectedVersion)
      throw new ConflictError('This draft has changed. Reload it before submitting.');

    const intake = ClaimIntakeSchema.parse(claim.revisions[0].intake);
    const check = evaluateClaimCompleteness(intake);
    if (emergencyReason && check.complete)
      throw new ValidationError('An emergency reason is only needed for an incomplete claim.');
    if (!check.complete && (!check.canSubmitAsEmergency || !emergencyReason)) {
      throw new ValidationError(
        'Complete the missing fields, or provide a valid emergency reason.',
        check,
      );
    }

    const saved = await submitTransition(
      tx,
      claim,
      actor,
      intake,
      check.missingFields,
      emergencyReason,
    );
    return hospitalResponse(saved, intake);
  });
}

export async function listHospitalClaims(actor: AuthenticatedActor, query: ClaimListQuery) {
  const where: Prisma.ClaimWhereInput = withHospitalScope(
    actor,
    query.status ? { status: query.status } : {},
  );
  const [totalItems, claims] = await prisma.$transaction([
    prisma.claim.count({ where }),
    prisma.claim.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        memberId: true,
        status: true,
        version: true,
        currentRevision: true,
        originalReceiptAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);
  return {
    items: claims.map((claim) => ({
      id: claim.id,
      memberId: claim.memberId,
      status: claim.status,
      version: claim.version,
      revision: claim.currentRevision,
      originalReceiptAt: claim.originalReceiptAt?.toISOString() ?? null,
      createdAt: claim.createdAt.toISOString(),
      updatedAt: claim.updatedAt.toISOString(),
    })),
    pagination: buildPaginationMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
  };
}
