import { z } from 'zod';
import { IsoDateTimeSchema, UuidSchema } from './common';
import { DocumentTypeSchema } from './documents';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const PositiveInt = z.number().int().positive();

export const AiDocumentRefSchema = z
  .object({
    document_id: UuidSchema,
    version_id: UuidSchema,
    type: DocumentTypeSchema,
    sha256: HashSchema,
    object_key: z.string().min(1),
  })
  .strict();

export const AiJobInputSchema = z
  .object({
    job_id: UuidSchema,
    claim_id: UuidSchema,
    claim_revision: PositiveInt,
    attempt_generation: PositiveInt,
    lease_token: UuidSchema,
    document_set_hash: HashSchema,
    original_receipt_at: IsoDateTimeSchema,
    enrollment_id: UuidSchema,
    member_id: UuidSchema,
    policy_version_id: UuidSchema,
    addon_version_ids: z.array(UuidSchema),
    documents: z.array(AiDocumentRefSchema),
  })
  .strict();
export type AiJobInput = z.infer<typeof AiJobInputSchema>;

export const AiEvidenceSchema = z
  .object({
    source_kind: z.enum(['DOCUMENT', 'POLICY_CLAUSE', 'CHECKLIST_RULE']),
    source_id: UuidSchema,
    page: PositiveInt,
    quote: z.string().min(1).max(500),
  })
  .strict();

export const AiFindingSchema = z
  .object({
    kind: z.enum(['DOCUMENT_GAP', 'CLINICAL_UNCERTAINTY', 'POLICY_CHECK']),
    summary: z.string().min(1).max(500),
    evidence: z.array(AiEvidenceSchema).min(1),
  })
  .strict();

export const AiCallbackSchema = z
  .object({
    job_id: UuidSchema,
    claim_id: UuidSchema,
    claim_revision: PositiveInt,
    attempt_generation: PositiveInt,
    lease_token: UuidSchema,
    document_set_hash: HashSchema,
    status: z.enum(['SUCCEEDED', 'PARTIAL', 'FAILED']),
    stages: z.array(
      z
        .object({
          name: z.string().min(1),
          status: z.enum(['succeeded', 'partial', 'failed', 'skipped', 'reused']),
        })
        .strict(),
    ),
    findings: z.array(AiFindingSchema),
    error_code: z
      .string()
      .regex(/^[A-Z_]{1,80}$/)
      .nullable(),
  })
  .strict();
export type AiCallback = z.infer<typeof AiCallbackSchema>;

export const AiJobStatusViewSchema = z
  .object({
    status: z.enum([
      'QUEUED',
      'RUNNING',
      'SUCCEEDED',
      'PARTIAL',
      'FAILED',
      'MANUAL_REVIEW',
      'SUPERSEDED',
    ]),
    stage: z.string().nullable(),
    attempt: z.number().int().nonnegative(),
    maxAttempts: PositiveInt,
    retryAvailable: z.boolean(),
    degraded: z.boolean(),
    errorCode: z.string().nullable(),
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type AiJobStatusView = z.infer<typeof AiJobStatusViewSchema>;

export const AiHeartbeatSchema = z
  .object({
    attempt_generation: PositiveInt,
    lease_token: UuidSchema,
    stage: z.string().regex(/^[a-z_]{1,80}$/),
  })
  .strict();
