import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/app-error';

/**
 * 404 Catch-All Middleware
 * Placed after all registered routes. Any request that does not match an existing endpoint
 * is captured here and passed to the centralized error handler as a NotFoundError.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const error = new NotFoundError(
    `Cannot ${req.method} ${req.originalUrl}. Route does not exist on this server.`,
  );
  next(error);
}

export default notFoundHandler;
