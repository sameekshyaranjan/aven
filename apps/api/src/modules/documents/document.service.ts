import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  ClaimIntakeSchema,
  DocumentSchema,
  DocumentTypeSchema,
  DownloadTargetSchema,
  InitiateDocumentUploadSchema,
  UploadTargetSchema,
  UuidSchema,
} from '@aven/contracts';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../errors/app-error';
import type { AuthenticatedActor } from '../auth/auth.types';
import { requireHospitalId } from '../auth/hospital-scope';
import {
  deleteTemporaryObject,
  downloadUrl,
  ensureDocumentBucket,
  readUploadedObject,
  saveValidatedObject,
  uploadUrl,
} from './object-store';
import { validatePdf } from './pdf-validation';

const writableStatuses = [
  'DRAFT',
  'SUBMITTED',
  'ANALYSING',
  'NEEDS_INFORMATION',
  'READY_FOR_REVIEW',
  'UNDER_REVIEW',
] as const;
const tokenSchema = z.object({
  claimId: UuidSchema,
  uploadedById: UuidSchema,
  uploadId: UuidSchema,
  type: DocumentTypeSchema,
  sizeBytes: z.number().int().positive(),
  sha256: z.string(),
  replacesDocumentId: UuidSchema.optional(),
  replacementReason: z.string().optional(),
});
type UploadRequest = z.infer<typeof InitiateDocumentUploadSchema>;

async function authorizedClaim(actor: AuthenticatedActor, claimId: string, write: boolean) {
  if (write && actor.role !== 'HOSPITAL_DESK') throw new ForbiddenError();
  if (!write && !['HOSPITAL_DESK', 'INSURER_REVIEWER', 'ADMIN'].includes(actor.role))
    throw new ForbiddenError();
  const claim = await prisma.claim.findFirst({
    where: {
      id: claimId,
      ...(actor.role === 'HOSPITAL_DESK' ? { hospitalId: requireHospitalId(actor) } : {}),
    },
  });
  if (!claim) throw new NotFoundError('Claim was not found.');
  if (write && !writableStatuses.includes(claim.status as (typeof writableStatuses)[number]))
    throw new ValidationError('Documents cannot be changed in this claim state.');
  return claim;
}

function objectKeys(claimId: string, uploadId: string) {
  return {
    temporary: `claims/${claimId}/uploads/${uploadId}.pdf`,
    permanent: `claims/${claimId}/documents/${uploadId}.pdf`,
  };
}

function verifyUploadToken(token: string) {
  try {
    return tokenSchema.parse(
      jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'aven-api',
        audience: 'aven-document-upload',
      }),
    );
  } catch {
    throw new UnauthorizedError('Upload authorization is invalid or expired.');
  }
}

export async function initiateUpload(
  actor: AuthenticatedActor,
  claimId: string,
  input: UploadRequest,
) {
  await authorizedClaim(actor, claimId, true);
  if (input.replacesDocumentId) {
    const existing = await prisma.document.findFirst({
      where: { id: input.replacesDocumentId, claimId },
    });
    if (!existing) throw new NotFoundError('Document was not found.');
    if (existing.type !== input.type)
      throw new ValidationError('Replacement document type must stay the same.');
  }
  await ensureDocumentBucket();
  const uploadId = randomUUID();
  const { temporary } = objectKeys(claimId, uploadId);
  const uploadToken = jwt.sign(
    {
      claimId,
      uploadedById: actor.userId,
      uploadId,
      ...input,
      sha256: input.sha256.toLowerCase(),
    },
    env.JWT_SECRET,
    { algorithm: 'HS256', issuer: 'aven-api', audience: 'aven-document-upload', expiresIn: '15m' },
  );
  return UploadTargetSchema.parse({
    uploadUrl: await uploadUrl(temporary),
    uploadToken,
    expiresInSeconds: 300,
    requiredHeaders: { 'Content-Type': 'application/pdf' },
  });
}

async function advanceClaimRevision(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  claimId: string,
) {
  const claim = await tx.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
  });
  const changed = await tx.claim.updateMany({
    where: {
      id: claimId,
      hospitalId: requireHospitalId(actor),
      version: claim.version,
      status: { in: [...writableStatuses] },
    },
    data: { version: { increment: 1 }, currentRevision: { increment: 1 } },
  });
  if (changed.count !== 1 || !claim.revisions[0])
    throw new ConflictError('Claim changed. Retry the upload.');
  await tx.claimRevision.create({
    data: {
      claimId,
      revisionNumber: claim.currentRevision + 1,
      intake: ClaimIntakeSchema.parse(claim.revisions[0].intake),
    },
  });
}

const documentInclude = {
  versions: {
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { version: 'desc' as const },
  },
};

function documentDto(document: Awaited<ReturnType<typeof getStoredDocument>>) {
  return DocumentSchema.parse({
    ...document,
    versions: document.versions.map((version) => ({
      ...version,
      createdAt: version.createdAt.toISOString(),
    })),
  });
}

async function getStoredDocument(documentId: string, claimId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, claimId },
    include: documentInclude,
  });
  if (!document) throw new NotFoundError('Document was not found.');
  return document;
}

export async function finalizeUpload(actor: AuthenticatedActor, claimId: string, rawToken: string) {
  const token = verifyUploadToken(rawToken);
  if (token.claimId !== claimId || token.uploadedById !== actor.userId) throw new ForbiddenError();
  await authorizedClaim(actor, claimId, true);
  const keys = objectKeys(claimId, token.uploadId);
  const alreadySaved = await prisma.documentVersion.findUnique({
    where: { objectKey: keys.permanent },
  });
  if (alreadySaved) return documentDto(await getStoredDocument(alreadySaved.documentId, claimId));

  let uploaded;
  try {
    uploaded = await readUploadedObject(keys.temporary);
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
      throw new ValidationError('The uploaded file was not found.');
    throw error;
  }
  await validatePdf(uploaded.bytes, token.sha256, token.sizeBytes);
  await saveValidatedObject(keys.permanent, uploaded.bytes);

  const documentId = await prisma.$transaction(async (tx) => {
    await advanceClaimRevision(tx, actor, claimId);
    const versionData = {
      objectKey: keys.permanent,
      sha256: token.sha256,
      sizeBytes: token.sizeBytes,
      mediaType: uploaded.mediaType,
      uploadedByUserId: actor.userId,
      processingStatus: 'READY' as const,
      replacementReason: token.replacementReason,
    };
    if (!token.replacesDocumentId) {
      const created = await tx.document.create({
        data: {
          claimId,
          type: token.type,
          versions: { create: { version: 1, ...versionData } },
        },
      });
      return created.id;
    }
    const existing = await tx.document.findFirst({
      where: { id: token.replacesDocumentId, claimId },
    });
    if (!existing || existing.type !== token.type)
      throw new NotFoundError('Document was not found.');
    const changed = await tx.document.updateMany({
      where: { id: existing.id, claimId, currentVersion: existing.currentVersion },
      data: { currentVersion: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictError('Document changed. Retry the replacement.');
    await tx.documentVersion.create({
      data: {
        documentId: existing.id,
        version: existing.currentVersion + 1,
        ...versionData,
      },
    });
    return existing.id;
  });
  await deleteTemporaryObject(keys.temporary).catch(() => undefined);
  return documentDto(await getStoredDocument(documentId, claimId));
}

export async function listDocuments(actor: AuthenticatedActor, claimId: string) {
  await authorizedClaim(actor, claimId, false);
  const documents = await prisma.document.findMany({
    where: { claimId },
    include: documentInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return documents.map(documentDto);
}

export async function getDocumentDownload(
  actor: AuthenticatedActor,
  claimId: string,
  documentId: string,
  version: number,
) {
  await authorizedClaim(actor, claimId, false);
  const document = await getStoredDocument(documentId, claimId);
  const selected = document.versions.find((item) => item.version === version);
  if (!selected) throw new NotFoundError('Document version was not found.');
  return DownloadTargetSchema.parse({
    url: await downloadUrl(selected.objectKey),
    expiresInSeconds: 60,
  });
}
