import { z } from 'zod';
import { IsoDateTimeSchema, UuidSchema } from './common';

export const DocumentTypeSchema = z.enum([
  'PREAUTH_FORM',
  'MEMBER_PROOF',
  'CLINICAL_NOTE',
  'INVESTIGATION_REPORT',
  'TREATMENT_PLAN',
  'ESTIMATE',
  'CONSENT',
  'OTHER',
]);

export const DocumentStatusSchema = z.enum([
  'UPLOADED',
  'VALIDATING',
  'READY',
  'ANALYSING',
  'ANALYSED',
  'UNREADABLE',
  'FAILED',
]);

export const InitiateDocumentUploadSchema = z
  .object({
    type: DocumentTypeSchema,
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    replacesDocumentId: UuidSchema.optional(),
    replacementReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.replacesDocumentId) === Boolean(value.replacementReason),
    'A replacement needs both a document ID and a reason',
  );

export const FinalizeDocumentUploadSchema = z.object({ uploadToken: z.string().min(1) }).strict();

export const UploadTargetSchema = z.object({
  uploadUrl: z.string().url(),
  uploadToken: z.string(),
  expiresInSeconds: z.literal(300),
  requiredHeaders: z.record(z.string()),
});

export const DownloadTargetSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.literal(60),
});

export const DocumentVersionSchema = z.object({
  id: UuidSchema,
  version: z.number().int().positive(),
  sha256: z.string(),
  sizeBytes: z.number().int().positive(),
  mediaType: z.literal('application/pdf'),
  processingStatus: DocumentStatusSchema,
  uploadedBy: z.object({ id: UuidSchema, name: z.string() }),
  replacementReason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});

export const DocumentSchema = z.object({
  id: UuidSchema,
  claimId: UuidSchema,
  type: DocumentTypeSchema,
  currentVersion: z.number().int().positive(),
  versions: z.array(DocumentVersionSchema),
});
export type DocumentData = z.infer<typeof DocumentSchema>;
