import jwt, { JsonWebTokenError, NotBeforeError, TokenExpiredError } from 'jsonwebtoken';
import { z } from 'zod';
import { ERROR_CODES, UserRoleSchema, UuidSchema } from '@aven/contracts';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { UnauthorizedError } from '../../errors/app-error';
import { USER_JWT_AUDIENCE, USER_JWT_ISSUER } from './login.service';
import type { AuthenticatedActor } from './auth.types';

const UserSessionClaimsSchema = z
  .object({
    sub: UuidSchema,
    tokenKind: z.literal('user_session'),
    role: UserRoleSchema,
    hospitalId: UuidSchema.nullable(),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .passthrough();

type UserSessionClaims = z.infer<typeof UserSessionClaimsSchema>;

function unauthenticatedError(message = 'Authentication is required.') {
  return new UnauthorizedError(message, ERROR_CODES.UNAUTHENTICATED);
}

function readBearerToken(req: Request): string {
  const authorization = req.get('authorization');

  if (!authorization) {
    throw unauthenticatedError();
  }

  const [scheme, token, extraPart] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || extraPart) {
    throw unauthenticatedError('A valid Bearer token is required.');
  }

  return token;
}

function verifyUserSessionToken(token: string): UserSessionClaims {
  let payload: string | jwt.JwtPayload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: USER_JWT_AUDIENCE,
      issuer: USER_JWT_ISSUER,
    });
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError('The session token has expired.', ERROR_CODES.TOKEN_EXPIRED);
    }

    if (error instanceof JsonWebTokenError || error instanceof NotBeforeError) {
      throw unauthenticatedError('The session token is invalid.');
    }

    throw error;
  }

  const result = UserSessionClaimsSchema.safeParse(payload);

  if (!result.success) {
    throw unauthenticatedError('The session token is invalid.');
  }

  return result.data;
}

/**
 * Verifies a human web-session JWT, checks current account state, and attaches
 * a trusted actor. It never logs or exposes the bearer token.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readBearerToken(req);
    const claims = verifyUserSessionToken(token);

    const user = await prisma.user.findFirst({
      where: {
        id: claims.sub,
        isActive: true,
        hospital: { is: { isActive: true } },
      },
      select: {
        id: true,
        role: true,
        hospitalId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError(
        'The account for this session is inactive or unavailable.',
        ERROR_CODES.ACCOUNT_INACTIVE,
      );
    }

    if (user.role !== claims.role || user.hospitalId !== claims.hospitalId) {
      throw unauthenticatedError('The session is no longer valid. Please log in again.');
    }

    const actor: AuthenticatedActor = {
      userId: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
    };

    req.actor = actor;
    next();
  } catch (error) {
    next(error);
  }
}
