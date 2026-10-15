/**
 * Common primitive schemas shared across all Aven contracts.
 *
 * Design notes:
 *  - UuidSchema: validates the standard 8-4-4-4-12 UUID format. Used for
 *    every entity ID (hospitals, users, claims, documents, etc.).
 *  - IsoDateSchema: validates ISO 8601 datetime strings. The API always
 *    serializes dates as strings over JSON — never raw Date objects — so
 *    clients receive a consistent, timezone-aware string format.
 *  - IsoDateOnlySchema: validates YYYY-MM-DD date strings used for
 *    admission dates, birth dates, and policy effective dates where
 *    time-of-day is irrelevant.
 *
 * No Express, Prisma, or Node-specific imports are allowed here.
 * This file must be safe to import in both apps/api and apps/web.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// UUID
// ---------------------------------------------------------------------------

/**
 * Validates a standard UUID (v4 format: 8-4-4-4-12 hex groups).
 * Used as the type for all entity primary keys.
 *
 * @example "b1000000-0000-4000-8000-000000000001"
 */
export const UuidSchema = z
  .string()
  .uuid({ message: 'Must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)' });

export type Uuid = z.infer<typeof UuidSchema>;

// ---------------------------------------------------------------------------
// ISO datetime string (full timestamp with timezone)
// ---------------------------------------------------------------------------

/**
 * Validates an ISO 8601 datetime string.
 * All API timestamps are serialized as strings, never raw Date objects.
 *
 * @example "2026-10-09T17:16:40.791Z"
 */
export const IsoDateTimeSchema = z
  .string()
  .datetime({ message: 'Must be an ISO 8601 datetime string (e.g. 2026-10-09T17:16:40.791Z)' });

export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

// ---------------------------------------------------------------------------
// ISO date-only string (YYYY-MM-DD)
// ---------------------------------------------------------------------------

/**
 * Validates a YYYY-MM-DD date string.
 * Used for admission dates, birth dates, and policy effective dates
 * where time-of-day precision is not required.
 *
 * @example "2026-10-09"
 */
export const IsoDateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Must be a YYYY-MM-DD date string (e.g. 2026-10-09)',
  });

export type IsoDateOnly = z.infer<typeof IsoDateOnlySchema>;

// ---------------------------------------------------------------------------
// Positive integer (for counts, amounts, page numbers)
// ---------------------------------------------------------------------------

/**
 * A positive integer (>= 1). Used for page numbers, item counts, etc.
 */
export const PositiveIntSchema = z
  .number()
  .int({ message: 'Must be an integer' })
  .positive({ message: 'Must be greater than zero' });

export type PositiveInt = z.infer<typeof PositiveIntSchema>;

/**
 * A non-negative integer (>= 0). Used for zero-indexed offsets, totals.
 */
export const NonNegativeIntSchema = z
  .number()
  .int({ message: 'Must be an integer' })
  .nonnegative({ message: 'Must be zero or greater' });

export type NonNegativeInt = z.infer<typeof NonNegativeIntSchema>;
