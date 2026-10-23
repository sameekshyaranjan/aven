import { z } from 'zod';
import { ClaimIntakeSchema, ClaimStatusSchema } from './claims';
import { IsoDateTimeSchema, UuidSchema } from './common';
import { PaginationQuerySchema } from './pagination';

export const ReviewerQueueQuerySchema = PaginationQuerySchema.extend({
  status: ClaimStatusSchema.optional(),
  hospitalId: UuidSchema.optional(),
  olderThanHours: z.coerce.number().int().positive().max(8760).optional(),
  actionRequired: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
}).strict();

export const ReviewerQueueItemSchema = z.object({
  id: UuidSchema,
  hospitalName: z.string(),
  memberName: z.string(),
  status: ClaimStatusSchema,
  version: z.number().int().positive(),
  revision: z.number().int().positive(),
  originalReceiptAt: IsoDateTimeSchema.nullable(),
  updatedAt: IsoDateTimeSchema,
});
export type ReviewerQueueItem = z.infer<typeof ReviewerQueueItemSchema>;

export const HospitalOptionSchema = z.object({ id: UuidSchema, name: z.string() });

export const ReviewerClaimSchema = ReviewerQueueItemSchema.extend({
  policyName: z.string(),
  emergencyReason: z.string().nullable(),
  missingAtSubmission: z.array(z.string()),
  intake: ClaimIntakeSchema,
  revisions: z.array(
    z.object({
      number: z.number().int().positive(),
      intake: ClaimIntakeSchema,
      createdAt: IsoDateTimeSchema,
    }),
  ),
});
export type ReviewerClaim = z.infer<typeof ReviewerClaimSchema>;

export const ReviewActionInputSchema = z
  .object({
    kind: z.enum(['NOTE', 'CONFIRM', 'FLAG']),
    fieldKey: z.string().max(100).optional(),
    text: z.string().trim().min(1).max(1000),
  })
  .strict();
export const ReviewActionSchema = ReviewActionInputSchema.extend({
  id: UuidSchema,
  actorName: z.string(),
  createdAt: IsoDateTimeSchema,
});
export type ReviewAction = z.infer<typeof ReviewActionSchema>;

export const RequestItemSchema = z
  .object({
    prompt: z.string().trim().min(1).max(300),
    reason: z.string().trim().min(1).max(500),
    acceptedAlternatives: z.array(z.string().trim().min(1).max(160)).max(5),
  })
  .strict();
export const CreateInformationRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    items: z.array(RequestItemSchema).min(1).max(10),
  })
  .strict();
export const RespondToRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    answers: z
      .array(
        z.object({
          itemIndex: z.number().int().nonnegative(),
          text: z.string().trim().min(1).max(2000),
        }),
      )
      .max(10),
    documentIds: z.array(UuidSchema).max(20),
  })
  .strict()
  .refine(
    (value) => value.answers.length + value.documentIds.length > 0,
    'Add an answer or document',
  );

export const InformationRequestSchema = z.object({
  id: UuidSchema,
  status: z.enum(['OPEN', 'RESPONSE_RECEIVED']),
  items: z.array(RequestItemSchema),
  publishedRevision: z.number().int().positive(),
  createdAt: IsoDateTimeSchema,
  response: z
    .object({
      answers: z.array(z.object({ itemIndex: z.number().int().nonnegative(), text: z.string() })),
      documentIds: z.array(UuidSchema),
      createdAt: IsoDateTimeSchema,
    })
    .nullable(),
});
export type InformationRequest = z.infer<typeof InformationRequestSchema>;

export const AuditEntrySchema = z.object({
  id: UuidSchema,
  kind: z.enum(['STATUS', 'DOCUMENT', 'ACTION', 'REQUEST', 'RESPONSE']),
  title: z.string(),
  actorName: z.string().optional(),
  createdAt: IsoDateTimeSchema,
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const NotificationSchema = z.object({
  id: UuidSchema,
  claimId: UuidSchema,
  title: z.string(),
  readAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type NotificationData = z.infer<typeof NotificationSchema>;
