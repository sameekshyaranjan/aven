import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

// Regex to validate incoming request ID: 8 to 128 characters, alphanumeric with hyphens or underscores
const VALID_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

/**
 * Request ID Middleware
 * Inspects incoming 'X-Request-Id' header for a valid correlation identifier.
 * If absent or invalid (e.g. malformed, potential header injection), generates a new UUIDv4.
 * Attaches the ID to req.id / req.requestId and sets it on the outgoing response headers.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingHeader = req.headers['x-request-id'];
  let requestId: string;

  if (typeof incomingHeader === 'string' && VALID_REQUEST_ID_REGEX.test(incomingHeader.trim())) {
    requestId = incomingHeader.trim();
  } else {
    requestId = randomUUID();
  }

  // Attach to request object for downstream controllers and loggers
  req.id = requestId;
  req.requestId = requestId;

  // Echo back in response header for end-to-end client observability
  res.setHeader('X-Request-Id', requestId);

  next();
}

export default requestIdMiddleware;
