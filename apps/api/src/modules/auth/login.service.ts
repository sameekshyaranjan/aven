import jwt from 'jsonwebtoken';
import { ERROR_CODES, LoginDataSchema, type LoginData } from '@aven/contracts';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { UnauthorizedError } from '../../errors/app-error';
import { isDemoStaffAccountId } from './demo-account.service';

export const USER_JWT_AUDIENCE = 'aven-web';
export const USER_JWT_ISSUER = 'aven-api';

const unavailableAccountError = () =>
  new UnauthorizedError('The selected demo account is unavailable.', ERROR_CODES.UNAUTHENTICATED);

function getSessionDurationSeconds(): number {
  const durationMinutes = Number.parseInt(env.JWT_EXPIRES_IN.slice(0, -1), 10);
  return durationMinutes * 60;
}

/**
 * Revalidates an allowlisted seeded staff account and issues its user-session JWT.
 * The token contains only identity and authorization-scoping claims; profile data
 * is returned separately and tokens must never be written to application logs.
 */
export async function loginDemoAccount(accountId: string): Promise<LoginData> {
  if (!isDemoStaffAccountId(accountId)) {
    throw unavailableAccountError();
  }

  const user = await prisma.user.findFirst({
    where: {
      id: accountId,
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
    throw unavailableAccountError();
  }

  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresInSeconds = getSessionDurationSeconds();
  const expiresAt = new Date((issuedAtSeconds + expiresInSeconds) * 1000).toISOString();

  const accessToken = jwt.sign(
    {
      iat: issuedAtSeconds,
      tokenKind: 'user_session',
      role: user.role,
      hospitalId: user.hospital?.id ?? null,
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      audience: USER_JWT_AUDIENCE,
      issuer: USER_JWT_ISSUER,
      subject: user.id,
      expiresIn: expiresInSeconds,
    },
  );

  return LoginDataSchema.parse({
    accessToken,
    tokenType: 'Bearer',
    expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hospital: user.hospital,
    },
  });
}
