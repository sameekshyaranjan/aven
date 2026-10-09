import { Response } from 'express';

/**
 * Standard Pagination Metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Standard Response Metadata
 * Anchors every response to a specific correlation request ID and ISO timestamp.
 */
export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

/**
 * Standard Structured Error Payload
 */
export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Success Envelope Contract
 */
export interface SuccessEnvelope<T> {
  data: T;
  meta: ResponseMeta;
  error: null;
}

/**
 * Error Envelope Contract
 */
export interface ErrorEnvelope {
  data: null;
  meta: ResponseMeta;
  error: ApiErrorPayload;
}

/**
 * Union type representing all API responses
 */
export type ApiResponseEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

/**
 * Extracts correlation requestId and builds response metadata
 */
export function buildMeta(res: Response, extraMeta?: Partial<ResponseMeta>): ResponseMeta {
  const reqId =
    (res.req?.id as string | undefined) ||
    (res.req?.requestId as string | undefined) ||
    (res.getHeader('X-Request-Id') as string | undefined) ||
    'unknown';

  return {
    requestId: reqId,
    timestamp: new Date().toISOString(),
    ...extraMeta,
  };
}

/**
 * Sends a successful HTTP response enclosed in the standard { data, meta, error: null } envelope.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  extraMeta?: Partial<ResponseMeta>,
): Response {
  const envelope: SuccessEnvelope<T> = {
    data,
    meta: buildMeta(res, extraMeta),
    error: null,
  };

  return res.status(statusCode).json(envelope);
}

/**
 * Sends a 201 Created HTTP response enclosed in the standard envelope.
 */
export function sendCreated<T>(
  res: Response,
  data: T,
  extraMeta?: Partial<ResponseMeta>,
): Response {
  return sendSuccess(res, data, 201, extraMeta);
}

/**
 * Sends an error HTTP response enclosed in the standard { data: null, meta, error } envelope.
 */
export function sendError(
  res: Response,
  error: ApiErrorPayload,
  statusCode = 400,
  extraMeta?: Partial<ResponseMeta>,
): Response {
  const envelope: ErrorEnvelope = {
    data: null,
    meta: buildMeta(res, extraMeta),
    error,
  };

  return res.status(statusCode).json(envelope);
}

/**
 * Convenience helper for 400 Bad Request
 */
export function sendBadRequest(
  res: Response,
  message = 'Bad Request',
  details?: unknown,
  code = 'BAD_REQUEST',
): Response {
  return sendError(res, { code, message, details }, 400);
}

/**
 * Convenience helper for 401 Unauthorized
 */
export function sendUnauthorized(
  res: Response,
  message = 'Authentication required',
  code = 'UNAUTHORIZED',
): Response {
  return sendError(res, { code, message }, 401);
}

/**
 * Convenience helper for 403 Forbidden
 */
export function sendForbidden(
  res: Response,
  message = 'Access forbidden',
  code = 'FORBIDDEN',
): Response {
  return sendError(res, { code, message }, 403);
}

/**
 * Convenience helper for 404 Not Found
 */
export function sendNotFound(
  res: Response,
  message = 'Resource not found',
  code = 'NOT_FOUND',
): Response {
  return sendError(res, { code, message }, 404);
}

/**
 * Convenience helper for 500 Internal Server Error
 */
export function sendInternalError(
  res: Response,
  message = 'Internal server error occurred',
  code = 'INTERNAL_SERVER_ERROR',
): Response {
  return sendError(res, { code, message }, 500);
}
