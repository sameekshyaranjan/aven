import { ERROR_CODES, type UserRole } from '@aven/contracts';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../errors/app-error';

/**
 * Builds a role guard for one or more allowed roles.
 * This middleware must run after `authenticate`, which supplies req.actor.
 */
export function authorizeRoles(...allowedRoles: readonly UserRole[]): RequestHandler {
  if (allowedRoles.length === 0) {
    throw new Error('authorizeRoles requires at least one allowed role.');
  }

  const allowedRoleSet = new Set<UserRole>(allowedRoles);

  return function roleAuthorizationGuard(req: Request, _res: Response, next: NextFunction): void {
    if (!req.actor) {
      next(
        new UnauthorizedError(
          'Authentication is required before role authorization.',
          ERROR_CODES.UNAUTHENTICATED,
        ),
      );
      return;
    }

    if (!allowedRoleSet.has(req.actor.role)) {
      next(
        new ForbiddenError(
          'You do not have permission to perform this action.',
          ERROR_CODES.FORBIDDEN,
        ),
      );
      return;
    }

    next();
  };
}

export const requireHospitalDesk = authorizeRoles('HOSPITAL_DESK');
export const requireInsurerReviewer = authorizeRoles('INSURER_REVIEWER');
export const requireAdmin = authorizeRoles('ADMIN');
