import { z } from 'zod';
import { IsoDateOnlySchema, UuidSchema } from './common';
import { SuccessEnvelopeSchema } from './envelope';
import { PolicyRuleTypeSchema } from './policy-rules';

function isRealIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Body for the read-only resolver; body fields stay out of request-path logs. */
export const PolicyContextRequestSchema = z
  .object({
    enrollmentId: UuidSchema,
    memberId: UuidSchema,
    serviceDate: IsoDateOnlySchema.refine(isRealIsoDate, 'Must be a real calendar date'),
  })
  .strict();
export type PolicyContextRequest = z.infer<typeof PolicyContextRequestSchema>;

export const PolicyContextIssueSchema = z
  .object({
    code: z.enum(['OUTSIDE_COVERAGE_PERIOD', 'INCOMPATIBLE_SELECTED_ADDON']),
    message: z.string().min(1),
    addonVersionId: UuidSchema.optional(),
  })
  .strict();

const PolicySummarySchema = z
  .object({
    productId: UuidSchema,
    productCode: z.string().min(1),
    productName: z.string().min(1),
    versionId: UuidSchema,
    versionNumber: z.number().int().positive(),
    status: z.literal('ACTIVE'),
  })
  .strict();

const EnrollmentSummarySchema = z
  .object({
    id: UuidSchema,
    policyNumber: z.string().min(1),
    coverageStart: IsoDateOnlySchema,
    coverageEnd: IsoDateOnlySchema,
  })
  .strict();

const CoveredMemberSchema = z
  .object({
    id: UuidSchema,
    memberCode: z.string().min(1),
    fullName: z.string().min(1),
    dateOfBirth: IsoDateOnlySchema,
    relationship: z.enum(['SELF', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER']),
    isPolicyholder: z.boolean(),
  })
  .strict();

const SelectedAddonSchema = z
  .object({
    versionId: UuidSchema,
    code: z.string().min(1),
    name: z.string().min(1),
    versionNumber: z.number().int().positive(),
    status: z.literal('ACTIVE'),
    isCompatible: z.boolean(),
  })
  .strict();

const PolicyClauseSummarySchema = z
  .object({
    id: UuidSchema,
    clauseId: z.string().min(1),
    versionNumber: z.number().int().positive(),
    heading: z.string().min(1),
    text: z.string().min(1),
    pageLabel: z.string().min(1),
    sourceVersion: z.string().min(1),
    addonVersionId: UuidSchema.nullable(),
  })
  .strict();

const PolicyRuleSummarySchema = z
  .object({
    id: UuidSchema,
    ruleId: z.string().min(1),
    versionNumber: z.number().int().positive(),
    ruleType: PolicyRuleTypeSchema,
    parameters: z.record(z.unknown()),
    priority: z.number().int().nonnegative(),
    addonVersionId: UuidSchema.nullable(),
    supportingClauseIds: z.array(UuidSchema),
  })
  .strict();

/** Complete reviewer-side snapshot resolved from one synthetic enrollment. */
export const PolicyContextSchema = z
  .object({
    resolutionStatus: z.enum(['RESOLVED', 'REVIEW_REQUIRED']),
    serviceDate: IsoDateOnlySchema,
    enrollment: EnrollmentSummarySchema,
    member: CoveredMemberSchema,
    policy: PolicySummarySchema,
    selectedAddons: z.array(SelectedAddonSchema),
    clauses: z.array(PolicyClauseSummarySchema),
    rules: z.array(PolicyRuleSummarySchema),
    issues: z.array(PolicyContextIssueSchema),
  })
  .strict();
export type PolicyContext = z.infer<typeof PolicyContextSchema>;

export const PolicyContextResponseSchema = SuccessEnvelopeSchema(PolicyContextSchema);
export type PolicyContextResponse = z.infer<typeof PolicyContextResponseSchema>;
