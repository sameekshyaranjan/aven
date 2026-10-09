import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

/**
 * Global Centralized Error Handling Middleware
 *
 * Catches all operational and unexpected errors flowing through Express.
 * Implements safe production error serialization:
 * - Domain errors (AppError) and validation errors (ZodError) are serialized with stable codes.
 * - Unexpected 500 exceptions hide sensitive stack traces and database details from clients in production,
 *   while preserving complete details in structured internal server logs.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.id || req.requestId || 'unknown';
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal server error occurred.';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    // Trusted operational domain error
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    // Request schema validation error
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof SyntaxError && 'status' in err && (err as { status: unknown }).status === 400 && 'body' in err) {
    // Express body-parser malformed JSON syntax error
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON payload in request body.';
  } else if (err instanceof Error) {
    // Unhandled / programmer error
    statusCode = 500;
    code = 'INTERNAL_SERVER_ERROR';

    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      message = err.message;
      details = {
        name: err.name,
        stack: err.stack,
      };
    }
  }

  // Structured Logging based on severity
  if (statusCode >= 500) {
    logger.error(
      `Unhandled Server Error on ${req.method} ${req.originalUrl}: ${err instanceof Error ? err.message : String(err)}`,
      err,
      {
        requestId,
        statusCode,
        code,
      },
    );
  } else {
    logger.warn(
      `Operational Error on ${req.method} ${req.originalUrl}: ${message}`,
      {
        requestId,
        statusCode,
        code,
        details,
      },
    );
  }

  sendError(res, { code, message, details }, statusCode);
}

export default errorHandler;
