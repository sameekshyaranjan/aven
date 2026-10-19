import { z } from 'zod';

/**
 * Closed rule vocabulary shared with Prisma's PolicyRuleType enum.
 * Adding another executable rule requires an explicit code change.
 */
export const PolicyRuleTypeSchema = z.enum([
  'WAITING_PERIOD',
  'CHECKLIST_APPLICABILITY',
  'ADDON_PRECEDENCE',
]);
export type PolicyRuleType = z.infer<typeof PolicyRuleTypeSchema>;

const RuleCodeSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Must use uppercase letters, numbers, and underscores');

const WaitingPeriodBaseSchema = z.object({
  durationMonths: z.number().int().nonnegative(),
  startDateSource: z.enum(['POLICY_EFFECTIVE_DATE', 'COVERED_PERSON_START_DATE']),
});

/** Parameters used later by the deterministic calendar-month calculator. */
export const WaitingPeriodRuleParametersSchema = z.discriminatedUnion('appliesTo', [
  WaitingPeriodBaseSchema.extend({
    appliesTo: z.literal('ALL_TREATMENTS'),
  }).strict(),
  WaitingPeriodBaseSchema.extend({
    appliesTo: z.literal('NAMED_CONDITION'),
    conditionCode: RuleCodeSchema,
  }).strict(),
]);
export type WaitingPeriodRuleParameters = z.infer<typeof WaitingPeriodRuleParametersSchema>;

const ChecklistConditionSchema = z.discriminatedUnion('operator', [
  z.object({ operator: z.literal('ALWAYS') }).strict(),
  z
    .object({
      operator: z.literal('EQUALS'),
      factPath: z.string().min(1).max(100),
      expectedValue: z.union([z.string().min(1), z.boolean()]),
    })
    .strict(),
  z
    .object({
      operator: z.literal('IN'),
      factPath: z.string().min(1).max(100),
      allowedValues: z.array(z.string().min(1)).min(1),
    })
    .strict(),
]);

/** Parameters deciding when a future checklist item applies. */
export const ChecklistApplicabilityRuleParametersSchema = z
  .object({
    checklistItemCode: RuleCodeSchema,
    condition: ChecklistConditionSchema,
  })
  .strict();
export type ChecklistApplicabilityRuleParameters = z.infer<
  typeof ChecklistApplicabilityRuleParametersSchema
>;

/**
 * An addon may waive a base rule or replace it with another typed rule.
 * Priority remains a database column so competing matches are deterministic.
 */
export const AddonPrecedenceRuleParametersSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('WAIVE'),
      targetRuleId: RuleCodeSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('OVERRIDE'),
      targetRuleId: RuleCodeSchema,
      replacementRuleId: RuleCodeSchema,
    })
    .strict(),
]);
export type AddonPrecedenceRuleParameters = z.infer<typeof AddonPrecedenceRuleParametersSchema>;

/** Validates that a rule type is paired with the correct parameter object. */
export const PolicyRuleDefinitionSchema = z.discriminatedUnion('ruleType', [
  z
    .object({
      ruleType: z.literal('WAITING_PERIOD'),
      parameters: WaitingPeriodRuleParametersSchema,
    })
    .strict(),
  z
    .object({
      ruleType: z.literal('CHECKLIST_APPLICABILITY'),
      parameters: ChecklistApplicabilityRuleParametersSchema,
    })
    .strict(),
  z
    .object({
      ruleType: z.literal('ADDON_PRECEDENCE'),
      parameters: AddonPrecedenceRuleParametersSchema,
    })
    .strict(),
]);
export type PolicyRuleDefinition = z.infer<typeof PolicyRuleDefinitionSchema>;
