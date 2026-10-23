import { z } from 'zod';
import { IsoDateOnlySchema, IsoDateTimeSchema, UuidSchema } from './common';
import { SuccessEnvelopeSchema } from './envelope';
import { PaginationQuerySchema } from './pagination';

const DateOnlySchema = IsoDateOnlySchema.refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Must be a real calendar date');

const ShortText = z.string().trim().min(1).max(200);
const LongText = z.string().trim().min(1).max(2000);

/** Drafts may be incomplete; the API checks completeness before submission. */
export const ClaimIntakeSchema = z
  .object({
    patientName: ShortText.optional(),
    patientDateOfBirth: DateOnlySchema.optional(),
    patientGender: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNKNOWN']).optional(),
    patientContact: ShortText.optional(),
    admissionType: z.enum(['PLANNED', 'EMERGENCY']).optional(),
    expectedAdmissionDate: DateOnlySchema.optional(),
    expectedDischargeDate: DateOnlySchema.optional(),
    provisionalDiagnosis: LongText.optional(),
    proposedTreatment: LongText.optional(),
    doctorName: ShortText.optional(),
    doctorRegistrationId: ShortText.optional(),
    roomCategory: ShortText.optional(),
    estimatedAmount: z.number().finite().nonnegative().optional(),
    attestationConfirmed: z.boolean().optional(),
    consentConfirmed: z.boolean().optional(),
  })
  .strict();
export type ClaimIntake = z.infer<typeof ClaimIntakeSchema>;

export const ClaimStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'ANALYSING',
  'NEEDS_INFORMATION',
  'READY_FOR_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REFUSAL_PENDING',
  'REFUSED',
  'CLOSED',
]);

export const CreateDraftClaimSchema = z
  .object({
    enrollmentId: UuidSchema,
    memberId: UuidSchema,
    intake: ClaimIntakeSchema.default({}),
  })
  .strict();
export type CreateDraftClaim = z.infer<typeof CreateDraftClaimSchema>;

/** PUT replaces the complete draft form. Send the version last read. */
export const UpdateDraftClaimSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    intake: ClaimIntakeSchema,
  })
  .strict();
export type UpdateDraftClaim = z.infer<typeof UpdateDraftClaimSchema>;

export const DraftClaimSchema = z
  .object({
    id: UuidSchema,
    memberId: UuidSchema,
    status: z.literal('DRAFT'),
    version: z.number().int().positive(),
    revision: z.number().int().positive(),
    intake: ClaimIntakeSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type DraftClaim = z.infer<typeof DraftClaimSchema>;
export const DraftClaimResponseSchema = SuccessEnvelopeSchema(DraftClaimSchema);

export const ClaimCompletenessSchema = z.object({
  ruleVersion: z.literal('intake-v1'),
  complete: z.boolean(),
  missingFields: z.array(z.string()),
  canSubmitAsEmergency: z.boolean(),
  missingEmergencyFields: z.array(z.string()),
});
export type ClaimCompleteness = z.infer<typeof ClaimCompletenessSchema>;

export const SubmitClaimSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    emergencyReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const HospitalClaimSchema = DraftClaimSchema.omit({ status: true }).extend({
  status: ClaimStatusSchema,
  originalReceiptAt: IsoDateTimeSchema.nullable(),
  emergencyReason: z.string().nullable(),
  missingAtSubmission: z.array(z.string()),
});
export type HospitalClaim = z.infer<typeof HospitalClaimSchema>;

export const ClaimListQuerySchema = PaginationQuerySchema.extend({
  status: ClaimStatusSchema.optional(),
}).strict();
export type ClaimListQuery = z.infer<typeof ClaimListQuerySchema>;

export const ClaimListItemSchema = HospitalClaimSchema.omit({
  intake: true,
  emergencyReason: true,
  missingAtSubmission: true,
});
export type ClaimListItem = z.infer<typeof ClaimListItemSchema>;
export const ClaimListResponseSchema = SuccessEnvelopeSchema(z.array(ClaimListItemSchema));

/** Only hospital-visible status history; internal event reasons stay in the API. */
export const HospitalTimelineItemSchema = z.object({
  id: UuidSchema,
  status: ClaimStatusSchema,
  createdAt: IsoDateTimeSchema,
});
export type HospitalTimelineItem = z.infer<typeof HospitalTimelineItemSchema>;
