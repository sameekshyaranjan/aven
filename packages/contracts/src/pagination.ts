/**
 * Pagination schemas for Aven list endpoints.
 *
 * Design notes:
 *  - PaginationQuerySchema: validates inbound query params from clients.
 *    Uses coerce so "?page=2&pageSize=20" (strings from URL) are safely
 *    converted to numbers before validation.
 *  - PaginationMetaSchema: the outbound pagination block embedded in the
 *    response envelope's `meta` field, telling the client exactly where
 *    they are in the result set.
 *
 * Page size is capped at 100 to prevent unbounded database queries.
 * Default page size of 20 is a sensible starting point for most list views.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Inbound pagination query parameters
// ---------------------------------------------------------------------------

/**
 * Validates and coerces URL query parameters for paginated list requests.
 *
 * Usage in Express route:
 *   const query = PaginationQuerySchema.parse(req.query);
 *   // query.page   → number (default: 1)
 *   // query.pageSize → number (default: 20)
 */
export const PaginationQuerySchema = z.object({
  page: z
    .coerce
    .number()
    .int({ message: 'page must be an integer' })
    .positive({ message: 'page must be 1 or greater' })
    .default(1),

  pageSize: z
    .coerce
    .number()
    .int({ message: 'pageSize must be an integer' })
    .positive({ message: 'pageSize must be 1 or greater' })
    .max(100, { message: 'pageSize cannot exceed 100' })
    .default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ---------------------------------------------------------------------------
// Outbound pagination metadata (included in response envelope meta)
// ---------------------------------------------------------------------------

/**
 * Describes the current position in a paginated result set.
 * Included in the `meta` field of every paginated response.
 *
 * @example
 * {
 *   page: 2,
 *   pageSize: 20,
 *   totalItems: 87,
 *   totalPages: 5,
 *   hasNextPage: true,
 *   hasPrevPage: true
 * }
 */
export const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

// ---------------------------------------------------------------------------
// Helper: build PaginationMeta from raw counts
// ---------------------------------------------------------------------------

/**
 * Calculates pagination metadata from a query result.
 * Keeps the arithmetic in one place so routes never compute it manually.
 *
 * @example
 * const meta = buildPaginationMeta({ page: 2, pageSize: 20, totalItems: 87 });
 * // → { page: 2, pageSize: 20, totalItems: 87, totalPages: 5, hasNextPage: true, hasPrevPage: true }
 */
export function buildPaginationMeta(params: {
  page: number;
  pageSize: number;
  totalItems: number;
}): PaginationMeta {
  const { page, pageSize, totalItems } = params;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
