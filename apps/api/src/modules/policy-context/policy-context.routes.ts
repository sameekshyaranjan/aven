import { PolicyContextRequestSchema } from '@aven/contracts';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { authorizeRoles } from '../auth/role.middleware';
import { sendSuccess } from '../../utils/response';
import { resolvePolicyContext } from './policy-context.service';

export const policyContextRouter = Router();

/** Reviewer/admin inspection only. Hospitals have no policy-detail route. */
policyContextRouter.post(
  '/resolve',
  authenticate,
  authorizeRoles('INSURER_REVIEWER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { enrollmentId, memberId, serviceDate } = PolicyContextRequestSchema.parse(req.body);
      const context = await resolvePolicyContext(enrollmentId, memberId, serviceDate);

      res.setHeader('Cache-Control', 'no-store');
      sendSuccess(res, context);
    } catch (error) {
      next(error);
    }
  },
);
