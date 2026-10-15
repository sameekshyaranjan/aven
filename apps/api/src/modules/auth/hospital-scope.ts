import { ERROR_CODES } from '@aven/contracts';
import { ForbiddenError } from '../../errors/app-error';
import type { AuthenticatedActor } from './auth.types';

export type HospitalScoped<TWhere extends object> = Omit<TWhere, 'hospitalId'> & {
  hospitalId: string;
};

/**
 * Returns the trusted hospital association carried by an authenticated
 * hospital-desk actor. Hospital routes should call this instead of accepting a
 * hospital ID from request input.
 */
export function requireHospitalId(actor: AuthenticatedActor): string {
  if (actor.role !== 'HOSPITAL_DESK' || actor.hospitalId === null) {
    throw new ForbiddenError(
      'A hospital association is required to access this resource.',
      ERROR_CODES.FORBIDDEN,
    );
  }

  return actor.hospitalId;
}

/**
 * Adds the authenticated desk user's hospital ID to a Prisma `where` object.
 * The trusted value is written last so request data cannot replace the scope.
 *
 * @example
 * prisma.claim.findFirst({
 *   where: withHospitalScope(req.actor, { id: claimId }),
 * });
 */
export function withHospitalScope<TWhere extends object>(
  actor: AuthenticatedActor,
  where: TWhere,
): HospitalScoped<TWhere> {
  const hospitalId = requireHospitalId(actor);

  return { ...where, hospitalId };
}
