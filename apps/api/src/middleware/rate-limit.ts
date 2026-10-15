import { ERROR_CODES } from '@aven/contracts';
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../utils/response';

function retryAfterSecondsFromHeader(value: string | number | string[] | undefined) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function createLimiter(options: {
  windowMs: number;
  limit: number;
  message: string;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      const retryAfterSeconds = retryAfterSecondsFromHeader(res.getHeader('Retry-After'));

      sendError(
        res,
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: options.message,
        },
        429,
        retryAfterSeconds === undefined ? undefined : { retryAfterSeconds },
      );
    },
  });
}

/** Protects the public account picker while allowing normal demo browsing. */
export const publicRouteRateLimiter = createLimiter({
  windowMs: env.PUBLIC_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.PUBLIC_RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many public requests. Please try again later.',
});

/** Uses a tighter quota for the endpoint that creates signed session tokens. */
export const loginRateLimiter = createLimiter({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.LOGIN_RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many login attempts. Please try again later.',
});
