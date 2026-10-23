/**
 * @aven/contracts — Public API
 *
 * Single entry point for all shared schemas and types.
 * Both apps/api and apps/web import exclusively from this package.
 *
 * @example
 * import { UuidSchema, PaginationQuerySchema, ApiResponse, ERROR_CODES } from '@aven/contracts';
 */

// Common primitives (UUIDs, ISO dates, integers)
export * from './common';

// Pagination query params and response metadata
export * from './pagination';

// Response envelope schemas and types
export * from './envelope';

// Seeded demo authentication request and response contracts
export * from './auth';

// Validated parameter shapes for deterministic policy rules
export * from './policy-rules';

// Reviewer-side resolved policy context
export * from './policy-context';

// Hospital claim drafts
export * from './claims';
export * from './documents';
export * from './review';
export * from './ai-job';
