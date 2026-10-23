import {
  ClaimIntakeSchema,
  InformationRequestSchema,
  ReviewerClaimSchema,
  ReviewerQueueItemSchema,
  RequestItemSchema,
  buildPaginationMeta,
  type ReviewAction,
} from '@aven/contracts';
import { Prisma, type Claim, type UserRole } from '@prisma/client';
import { prisma } from '../../db/prisma';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../errors/app-error';
import type { AuthenticatedActor } from '../auth/auth.types';
import { requireHospitalId } from '../auth/hospital-scope';
import { assertClaimTransition } from '../claims/claim-transition';

type QueueQuery = {
  page: number;
  pageSize: number;
  status?: Claim['status'];
  hospitalId?: string;
  olderThanHours?: number;
  actionRequired?: boolean;
};

async function findClaim(actor: AuthenticatedActor, id: string) {
  if (actor.role === 'PATIENT') throw new ForbiddenError();
  const claim = await prisma.claim.findFirst({
    where: {
      id,
      ...(actor.role === 'HOSPITAL_DESK' ? { hospitalId: requireHospitalId(actor) } : {}),
    },
  });
  if (!claim || (actor.role !== 'HOSPITAL_DESK' && claim.status === 'DRAFT'))
    throw new NotFoundError('Claim was not found.');
  return claim;
}

async function notifyRole(
  tx: Prisma.TransactionClient,
  claimId: string,
  role: UserRole,
  title: string,
  hospitalId?: string,
) {
  const users = await tx.user.findMany({
    where: { role, isActive: true, ...(hospitalId ? { hospitalId } : {}) },
    select: { id: true },
  });
  if (users.length)
    await tx.notification.createMany({
      data: users.map((user) => ({ userId: user.id, claimId, title })),
    });
}

export async function reviewerQueue(query: QueueQuery) {
  const filters: Prisma.ClaimWhereInput[] = [{ status: { not: 'DRAFT' } }];
  if (query.status) filters.push({ status: query.status });
  if (query.hospitalId) filters.push({ hospitalId: query.hospitalId });
  if (query.olderThanHours)
    filters.push({
      originalReceiptAt: { lte: new Date(Date.now() - query.olderThanHours * 3600000) },
    });
  if (query.actionRequired) filters.push({ status: { in: ['SUBMITTED', 'READY_FOR_REVIEW'] } });
  const where = { AND: filters };
  const [totalItems, claims] = await prisma.$transaction([
    prisma.claim.count({ where }),
    prisma.claim.findMany({
      where,
      orderBy: [{ originalReceiptAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { hospital: { select: { name: true } }, member: { select: { fullName: true } } },
    }),
  ]);
  return {
    items: claims.map((claim) =>
      ReviewerQueueItemSchema.parse({
        id: claim.id,
        hospitalName: claim.hospital.name,
        memberName: claim.member.fullName,
        status: claim.status,
        version: claim.version,
        revision: claim.currentRevision,
        originalReceiptAt: claim.originalReceiptAt?.toISOString() ?? null,
        updatedAt: claim.updatedAt.toISOString(),
      }),
    ),
    pagination: buildPaginationMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
  };
}

export async function reviewerHospitals() {
  return prisma.hospital.findMany({
    where: { claims: { some: { status: { not: 'DRAFT' } } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function reviewerClaim(id: string) {
  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      hospital: { select: { name: true } },
      member: { select: { fullName: true } },
      enrollment: { include: { policyVersion: { include: { policyProduct: true } } } },
      revisions: { orderBy: { revisionNumber: 'desc' } },
    },
  });
  if (!claim || claim.status === 'DRAFT' || !claim.revisions[0])
    throw new NotFoundError('Claim was not found.');
  return ReviewerClaimSchema.parse({
    id: claim.id,
    hospitalName: claim.hospital.name,
    memberName: claim.member.fullName,
    policyName: claim.enrollment.policyVersion.policyProduct.name,
    emergencyReason: claim.emergencyReason,
    missingAtSubmission: claim.missingAtSubmission ?? [],
    status: claim.status,
    version: claim.version,
    revision: claim.currentRevision,
    originalReceiptAt: claim.originalReceiptAt?.toISOString() ?? null,
    updatedAt: claim.updatedAt.toISOString(),
    intake: ClaimIntakeSchema.parse(claim.revisions[0].intake),
    revisions: claim.revisions.map((revision) => ({
      number: revision.revisionNumber,
      intake: ClaimIntakeSchema.parse(revision.intake),
      createdAt: revision.createdAt.toISOString(),
    })),
  });
}

export async function listActions(id: string) {
  await reviewerClaim(id);
  const actions = await prisma.reviewAction.findMany({
    where: { claimId: id },
    include: { actor: { select: { name: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return actions.map((action): ReviewAction => ({
    id: action.id,
    kind: action.kind,
    fieldKey: action.fieldKey ?? undefined,
    text: action.text,
    actorName: action.actor.name,
    createdAt: action.createdAt.toISOString(),
  }));
}

export async function addAction(
  actor: AuthenticatedActor,
  id: string,
  input: {
    kind: 'NOTE' | 'CONFIRM' | 'FLAG';
    fieldKey?: string;
    text: string;
  },
) {
  await reviewerClaim(id);
  if (
    input.kind === 'CONFIRM' &&
    (!input.fieldKey || !ClaimIntakeSchema.keyof().safeParse(input.fieldKey).success)
  )
    throw new ValidationError('Choose a claim field to confirm.');
  const action = await prisma.reviewAction.create({
    data: { claimId: id, actorUserId: actor.userId, ...input },
  });
  return {
    id: action.id,
    ...input,
    actorName: (await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } })).name,
    createdAt: action.createdAt.toISOString(),
  };
}

export async function listRequests(actor: AuthenticatedActor, id: string) {
  await findClaim(actor, id);
  const requests = await prisma.informationRequest.findMany({
    where: { claimId: id },
    include: { response: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return requests.map((request) =>
    InformationRequestSchema.parse({
      id: request.id,
      status: request.status,
      items: RequestItemSchema.array().parse(request.items),
      publishedRevision: request.publishedRevision,
      createdAt: request.createdAt.toISOString(),
      response: request.response
        ? {
            answers: request.response.answers,
            documentIds: request.response.documentIds,
            createdAt: request.response.createdAt.toISOString(),
          }
        : null,
    }),
  );
}

export async function createRequest(
  actor: AuthenticatedActor,
  id: string,
  input: {
    expectedVersion: number;
    items: { prompt: string; reason: string; acceptedAlternatives: string[] }[];
  },
) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({ where: { id } });
    if (!claim || claim.status === 'DRAFT') throw new NotFoundError('Claim was not found.');
    if (claim.version !== input.expectedVersion)
      throw new ConflictError('Claim changed. Reload it.');
    if (await tx.informationRequest.findFirst({ where: { claimId: id, status: 'OPEN' } }))
      throw new ConflictError('An information request is already open.');
    assertClaimTransition(claim.status, 'NEEDS_INFORMATION', actor.role);
    const changed = await tx.claim.updateMany({
      where: { id, version: input.expectedVersion, status: claim.status },
      data: { status: 'NEEDS_INFORMATION', version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictError('Claim changed. Reload it.');
    const request = await tx.informationRequest.create({
      data: {
        claimId: id,
        reviewerUserId: actor.userId,
        items: input.items,
        publishedRevision: claim.currentRevision,
      },
    });
    await tx.claimEvent.create({
      data: {
        claimId: id,
        actorUserId: actor.userId,
        fromStatus: claim.status,
        toStatus: 'NEEDS_INFORMATION',
        claimVersion: claim.version + 1,
      },
    });
    await notifyRole(
      tx,
      id,
      'HOSPITAL_DESK',
      'Information requested for a claim',
      claim.hospitalId,
    );
    return request.id;
  });
}

export async function respondToRequest(
  actor: AuthenticatedActor,
  id: string,
  requestId: string,
  input: {
    expectedVersion: number;
    answers: { itemIndex: number; text: string }[];
    documentIds: string[];
  },
) {
  const hospitalId = requireHospitalId(actor);
  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findFirst({
      where: { id, hospitalId },
      include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
    });
    if (!claim || !claim.revisions[0]) throw new NotFoundError('Claim was not found.');
    const request = await tx.informationRequest.findFirst({
      where: { id: requestId, claimId: id, status: 'OPEN' },
    });
    if (!request) throw new NotFoundError('Open request was not found.');
    if (claim.version !== input.expectedVersion)
      throw new ConflictError('Claim changed. Reload it.');
    assertClaimTransition(claim.status, 'READY_FOR_REVIEW', actor.role);
    const items = RequestItemSchema.array().parse(request.items);
    if (
      new Set(input.answers.map((a) => a.itemIndex)).size !== input.answers.length ||
      input.answers.some((a) => a.itemIndex >= items.length)
    )
      throw new ValidationError('Invalid answer item.');
    const docs = await tx.document.findMany({
      where: {
        id: { in: input.documentIds },
        claimId: id,
        versions: { some: { createdAt: { gte: request.createdAt } } },
      },
      select: { id: true },
    });
    if (docs.length !== new Set(input.documentIds).size)
      throw new ValidationError('Attach documents uploaded for this request.');
    const changed = await tx.claim.updateMany({
      where: { id, hospitalId, status: 'NEEDS_INFORMATION', version: input.expectedVersion },
      data: {
        status: 'READY_FOR_REVIEW',
        version: { increment: 1 },
        currentRevision: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictError('Claim changed. Reload it.');
    await tx.claimRevision.create({
      data: {
        claimId: id,
        revisionNumber: claim.currentRevision + 1,
        intake: ClaimIntakeSchema.parse(claim.revisions[0].intake),
      },
    });
    const updated = await tx.informationRequest.updateMany({
      where: { id: requestId, status: 'OPEN' },
      data: { status: 'RESPONSE_RECEIVED' },
    });
    if (updated.count !== 1) throw new ConflictError('Request was already answered.');
    await tx.informationResponse.create({
      data: {
        requestId,
        hospitalUserId: actor.userId,
        answers: input.answers,
        documentIds: input.documentIds,
      },
    });
    await tx.claimEvent.create({
      data: {
        claimId: id,
        actorUserId: actor.userId,
        fromStatus: 'NEEDS_INFORMATION',
        toStatus: 'READY_FOR_REVIEW',
        claimVersion: claim.version + 1,
      },
    });
    await notifyRole(tx, id, 'INSURER_REVIEWER', 'Hospital response received for a claim');
  });
  return listRequests(actor, id);
}

export async function auditTimeline(actor: AuthenticatedActor, id: string) {
  await findClaim(actor, id);
  const reviewer = actor.role !== 'HOSPITAL_DESK';
  const [events, documents, actions, requests] = await Promise.all([
    prisma.claimEvent.findMany({
      where: { claimId: id },
      include: { actor: { select: { name: true } } },
    }),
    prisma.documentVersion.findMany({
      where: { document: { claimId: id } },
      include: { document: true, uploadedBy: { select: { name: true } } },
    }),
    reviewer
      ? prisma.reviewAction.findMany({
          where: { claimId: id },
          include: { actor: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.informationRequest.findMany({
      where: { claimId: id },
      include: {
        reviewer: { select: { name: true } },
        response: { include: { hospitalUser: { select: { name: true } } } },
      },
    }),
  ]);
  return [
    ...events.map((x) => ({
      id: x.id,
      kind: 'STATUS',
      title: `Status: ${(reviewer ? x.toStatus : x.toStatus === 'REFUSAL_PENDING' ? 'UNDER_REVIEW' : x.toStatus).replaceAll('_', ' ')}`,
      actorName: reviewer ? x.actor?.name : undefined,
      createdAt: x.createdAt.toISOString(),
    })),
    ...documents.map((x) => ({
      id: x.id,
      kind: 'DOCUMENT',
      title: `${x.document.type.replaceAll('_', ' ')} uploaded`,
      actorName: reviewer ? x.uploadedBy.name : undefined,
      createdAt: x.createdAt.toISOString(),
    })),
    ...actions.map((x) => ({
      id: x.id,
      kind: 'ACTION',
      title: `Reviewer ${x.kind.toLowerCase()}`,
      actorName: x.actor.name,
      createdAt: x.createdAt.toISOString(),
    })),
    ...requests.map((x) => ({
      id: x.id,
      kind: 'REQUEST',
      title: 'Information requested',
      actorName: reviewer ? x.reviewer.name : undefined,
      createdAt: x.createdAt.toISOString(),
    })),
    ...requests.flatMap((x) =>
      x.response
        ? [
            {
              id: x.response.id,
              kind: 'RESPONSE',
              title: 'Hospital response received',
              actorName: reviewer ? x.response.hospitalUser.name : undefined,
              createdAt: x.response.createdAt.toISOString(),
            },
          ]
        : [],
    ),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export async function listNotifications(actor: AuthenticatedActor) {
  if (actor.role === 'PATIENT') throw new ForbiddenError();
  const items = await prisma.notification.findMany({
    where: { userId: actor.userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 20,
  });
  return items.map((item) => ({
    id: item.id,
    claimId: item.claimId,
    title: item.title,
    readAt: item.readAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(actor: AuthenticatedActor, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, userId: actor.userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (
    result.count === 0 &&
    !(await prisma.notification.findFirst({ where: { id, userId: actor.userId } }))
  )
    throw new NotFoundError('Notification was not found.');
  return listNotifications(actor);
}
