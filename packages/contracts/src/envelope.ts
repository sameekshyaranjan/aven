/**
 * Standard API response envelope schemas for Aven.
 *
 * Every endpoint — success or error — returns the same top-level shape:
 *   { data, meta, error }
 *
 * This makes client-side handling completely predictable:
 *   - Check error !== null → show error
 *   - Otherwise → use data
 *
 * Design notes:
 *  - ResponseMetaSchema: carries the correlation request ID and timestamp
 *    on every response so any response can be traced back to a log entry.
 *  - ApiErrorPayloadSchema: structured machine-readable error with a stable
 *    `code` string (e.g. "NOT_FOUND", "VALIDATION_ERROR") so clients can
 *    branch on the code rather than parsing human-readable messages.
 *  - SuccessEnvelopeSchema / ErrorEnvelopeSchema use z.discriminatedUnion
 *    equivalent via two separate schemas — TypeScript will narrow the type
 *    correctly when you check `if (response.error !== null)`.
 *
 * This file is framework-agnostic: no Express, no Next.js imports.
 * The Express helper functions (sendSuccess, sendError) live in
 * apps/api/src/utils/response.ts and use these types.
 */

import { z } from 'zod';
import { PaginationMetaSchema } from './pagination';

// ---------------------------------------------------------------------------
// Response metadata (present on every response)
// ---------------------------------------------------------------------------

/**
 * Standard metadata block attached to every API response.
 *
 * - `requestId`: correlates the response to a log entry via X-Request-Id
 * - `timestamp`: ISO 8601 time the response was generated
 * - `pagination`: present only on paginated list responses
 * - `retryAfterSeconds`: present when a rate-limited client should retry later
 */
export const ResponseMetaSchema = z.object({
  requestId: z.string(),
  timestamp: z.string().datetime(),
  pagination: PaginationMetaSchema.optional(),
  retryAfterSeconds: z.number().int().positive().optional(),
});

export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

// ---------------------------------------------------------------------------
// Structured error payload
// ---------------------------------------------------------------------------

/**
 * Machine-readable error returned in the `error` field on failure.
 *
 * - `code`: stable string constant clients can switch on (e.g. "NOT_FOUND")
 * - `message`: human-readable explanation safe for display
 * - `details`: optional structured validation details (e.g. Zod field errors)
 */
export const ApiErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiErrorPayload = z.infer<typeof ApiErrorPayloadSchema>;

// ---------------------------------------------------------------------------
// Success envelope  { data: T, meta, error: null }
// ---------------------------------------------------------------------------

/**
 * Builds a typed success envelope schema for a given data schema.
 *
 * @example
 * const HospitalResponseSchema = SuccessEnvelopeSchema(HospitalSchema);
 * type HospitalResponse = z.infer<typeof HospitalResponseSchema>;
 */
export function SuccessEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: ResponseMetaSchema,
    error: z.null(),
  });
}

/**
 * TypeScript type for a success envelope wrapping any data shape T.
 */
export type SuccessEnvelope<T> = {
  data: T;
  meta: ResponseMeta;
  error: null;
};

// ---------------------------------------------------------------------------
// Error envelope  { data: null, meta, error: ApiErrorPayload }
// ---------------------------------------------------------------------------

/**
 * Fixed schema for all error responses — data is always null on error.
 */
export const ErrorEnvelopeSchema = z.object({
  data: z.null(),
  meta: ResponseMetaSchema,
  error: ApiErrorPayloadSchema,
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Union type for typed API client usage
// ---------------------------------------------------------------------------

/**
 * Discriminated union of success and error responses.
 * Use this in the web app's API client to narrow the type:
 *
 * @example
 * const response: ApiResponse<Hospital> = await fetchHospital(id);
 * if (response.error !== null) {
 *   // TypeScript knows response.error is ApiErrorPayload here
 *   console.error(response.error.code);
 * } else {
 *   // TypeScript knows response.data is Hospital here
 *   console.log(response.data.name);
 * }
 */
export type ApiResponse<T> = SuccessEnvelope<T> | ErrorEnvelope;

// ---------------------------------------------------------------------------
// Well-known error codes — stable constants for client switch statements
// ---------------------------------------------------------------------------

/**
 * Stable error code constants matching the AppError classes in apps/api.
 * Import these in the web app to avoid stringly-typed comparisons.
 *
 * @example
 * if (response.error.code === ERROR_CODES.NOT_FOUND) { ... }
 */
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  ILLEGAL_TRANSITION: 'ILLEGAL_TRANSITION',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
