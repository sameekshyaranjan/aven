import { AuthenticatedUserSchema, ERROR_CODES, type AuthenticatedUser } from '@aven/contracts';
import { prisma } from '../../db/prisma';
import { UnauthorizedError } from '../../errors/app-error';
import type { AuthenticatedActor } from './auth.types';

/**
 * Loads the safe profile for the currently authenticated user.
 * The database remains authoritative for mutable profile and hospital data.
 */
export async function getCurrentUser(actor: AuthenticatedActor): Promise<AuthenticatedUser> {
  const user = await prisma.user.findFirst({
    where: {
      id: actor.userId,
      isActive: true,
      hospital: { is: { isActive: true } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      hospital: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError(
      'The account for this session is inactive or unavailable.',
      ERROR_CODES.ACCOUNT_INACTIVE,
    );
  }

  return AuthenticatedUserSchema.parse(user);
}
