import {
  ClaimListQuerySchema,
  CreateDraftClaimSchema,
  SubmitClaimSchema,
  UpdateDraftClaimSchema,
  UuidSchema,
} from '@aven/contracts';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { requireHospitalDesk } from '../auth/role.middleware';
import { sendCreated, sendSuccess } from '../../utils/response';
import {
  createDraftClaim,
  getClaimCompleteness,
  getHospitalClaim,
  getHospitalTimeline,
  listHospitalClaims,
  submitClaim,
  updateDraftClaim,
} from './claim.service';

export const claimRouter = Router();
claimRouter.use(authenticate, requireHospitalDesk);

claimRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enrollmentId, memberId, intake } = CreateDraftClaimSchema.parse(req.body);
    const draft = await createDraftClaim(req.actor!, enrollmentId, memberId, intake);
    res.setHeader('Cache-Control', 'no-store');
    sendCreated(res, draft);
  } catch (error) {
    next(error);
  }
});

claimRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listHospitalClaims(req.actor!, ClaimListQuerySchema.parse(req.query));
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, result.items, 200, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
});

claimRouter.get('/:id/completeness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getClaimCompleteness(req.actor!, UuidSchema.parse(req.params.id));
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

claimRouter.get('/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getHospitalTimeline(req.actor!, UuidSchema.parse(req.params.id));
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

claimRouter.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { expectedVersion, emergencyReason } = SubmitClaimSchema.parse(req.body);
    const result = await submitClaim(
      req.actor!,
      UuidSchema.parse(req.params.id),
      expectedVersion,
      emergencyReason,
    );
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

claimRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UuidSchema.parse(req.params.id);
    const draft = await getHospitalClaim(req.actor!, id);
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, draft);
  } catch (error) {
    next(error);
  }
});

claimRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UuidSchema.parse(req.params.id);
    const { expectedVersion, intake } = UpdateDraftClaimSchema.parse(req.body);
    const draft = await updateDraftClaim(req.actor!, id, expectedVersion, intake);
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, draft);
  } catch (error) {
    next(error);
  }
});
