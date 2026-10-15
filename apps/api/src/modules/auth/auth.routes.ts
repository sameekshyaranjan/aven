import { Router, type NextFunction, type Request, type Response } from 'express';
import { LoginRequestSchema } from '@aven/contracts';
import { loginRateLimiter, publicRouteRateLimiter } from '../../middleware/rate-limit';
import { sendSuccess } from '../../utils/response';
import { authenticate } from './auth.middleware';
import { getCurrentUser } from './current-user.service';
import { listDemoAccounts } from './demo-account.service';
import { loginDemoAccount } from './login.service';

export const authRouter = Router();

/**
 * Public account-picker endpoint for the fictional Aven demo.
 * No authentication middleware is applied because users need this list
 * before choosing an account. Only the service's safe allowlisted projection
 * is returned.
 */
authRouter.get(
  '/accounts',
  publicRouteRateLimiter,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await listDemoAccounts();
      res.setHeader('Cache-Control', 'no-store');
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Exchanges one allowed active seeded staff account for a short-lived JWT.
 * This portfolio demo intentionally has no passwords or public registration.
 */
authRouter.post(
  '/login',
  loginRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = LoginRequestSchema.parse(req.body);
      const data = await loginDemoAccount(accountId);
      res.setHeader('Cache-Control', 'no-store');
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Returns the current database-backed profile for a verified user session.
 * The response intentionally excludes tokens and internal account fields.
 */
authRouter.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getCurrentUser(req.actor!);
      res.setHeader('Cache-Control', 'no-store');
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  },
);
