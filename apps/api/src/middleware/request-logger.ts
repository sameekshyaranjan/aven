import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Request Logger Middleware
 * Logs incoming HTTP transactions once the response finishes.
 *
 * NON-NEGOTIABLE PRIVACY SAFEGUARD (PRD §5.5):
 * Request bodies and response bodies MUST NEVER be logged. In a health insurance pre-authorization
 * system, payloads carry sensitive protected health information (PHI) including patient identity,
 * diagnostic codes, clinical estimates, and doctor notes. Logging is strictly limited to transaction
 * metadata (method, route path, status, duration, correlation ID, and network headers).
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    // Convert nanoseconds to milliseconds rounded to two decimal places
    const durationMs = Math.round(Number(endTime - startTime) / 10_000) / 100;
    const { statusCode } = res;
    const path = req.originalUrl || req.url;

    const logContext = {
      requestId: req.id || req.requestId,
      method: req.method,
      path,
      statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent') || undefined,
    };

    const message = `HTTP ${req.method} ${path} ${statusCode} (${durationMs}ms)`;

    if (statusCode >= 500) {
      logger.error(message, undefined, logContext);
    } else if (statusCode >= 400) {
      logger.warn(message, logContext);
    } else {
      logger.info(message, logContext);
    }
  });

  next();
}

export default requestLoggerMiddleware;
