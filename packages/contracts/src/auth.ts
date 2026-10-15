/**
 * Shared shapes for seeded demo authentication.
 * These contracts describe JSON at the API boundary; they do not grant access.
 * The API still checks account status, signs tokens, and scopes every query.
 */

import { z } from 'zod';
import { UuidSchema, IsoDateTimeSchema } from './common';
import { SuccessEnvelopeSchema } from './envelope';

// Keep these values aligned with the Prisma UserRole enum.
export const UserRoleSchema = z.enum(['HOSPITAL_DESK', 'INSURER_REVIEWER', 'ADMIN', 'PATIENT']);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** Public account-picker entry: no email, token, or other private fields. */
export const DemoAccountSchema = z
  .object({
    id: UuidSchema,
    name: z.string().min(1),
    role: UserRoleSchema,
    hospitalName: z.string().min(1).nullable(),
  })
  .strict();
export type DemoAccount = z.infer<typeof DemoAccountSchema>;

export const AccountListDataSchema = z
  .object({
    accounts: z.array(DemoAccountSchema),
  })
  .strict();
export type AccountListData = z.infer<typeof AccountListDataSchema>;
export const AccountListResponseSchema = SuccessEnvelopeSchema(AccountListDataSchema);
export type AccountListResponse = z.infer<typeof AccountListResponseSchema>;

/** The selected seeded account ID is the only input to demo login. */
export const LoginRequestSchema = z.object({ accountId: UuidSchema }).strict();
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Safe profile returned after authentication and by GET /auth/me. */
export const AuthenticatedUserSchema = z
  .object({
    id: UuidSchema,
    name: z.string().min(1),
    email: z.string().email(),
    role: UserRoleSchema,
    hospital: z
      .object({
        id: UuidSchema,
        name: z.string().min(1),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
export const AuthenticatedUserResponseSchema = SuccessEnvelopeSchema(AuthenticatedUserSchema);
export type AuthenticatedUserResponse = z.infer<typeof AuthenticatedUserResponseSchema>;

/** Login returns the signed bearer token plus the authenticated profile. */
export const LoginDataSchema = z
  .object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    expiresAt: IsoDateTimeSchema,
    user: AuthenticatedUserSchema,
  })
  .strict();
export type LoginData = z.infer<typeof LoginDataSchema>;
export const LoginResponseSchema = SuccessEnvelopeSchema(LoginDataSchema);
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
