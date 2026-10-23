import {
  CreateInformationRequestSchema,
  RespondToRequestSchema,
  ReviewActionInputSchema,
  ReviewerQueueQuerySchema,
  UuidSchema,
} from '@aven/contracts';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { authorizeRoles, requireHospitalDesk } from '../auth/role.middleware';
import { sendCreated, sendSuccess } from '../../utils/response';
import {
  addAction,
  auditTimeline,
  createRequest,
  listActions,
  listNotifications,
  listRequests,
  markNotificationRead,
  respondToRequest,
  reviewerClaim,
  reviewerQueue,
  reviewerHospitals,
} from './review.service';
import { reviewerJobStatus } from '../ai-jobs/ai-job.service';

const staff = authorizeRoles('INSURER_REVIEWER', 'ADMIN');
const claimUsers = authorizeRoles('HOSPITAL_DESK', 'INSURER_REVIEWER', 'ADMIN');
const route =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    run(req, res).catch(next);
  };
const id = (req: Request) => UuidSchema.parse(req.params.id);

export const reviewRouter = Router();
reviewRouter.use(authenticate, (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

reviewRouter.get(
  '/queue',
  staff,
  route(async (req, res) => {
    const result = await reviewerQueue(ReviewerQueueQuerySchema.parse(req.query));
    sendSuccess(res, result.items, 200, { pagination: result.pagination });
  }),
);
reviewRouter.get(
  '/hospitals',
  staff,
  route(async (_req, res) => {
    sendSuccess(res, await reviewerHospitals());
  }),
);
reviewRouter.get(
  '/claims/:id',
  staff,
  route(async (req, res) => {
    sendSuccess(res, await reviewerClaim(id(req)));
  }),
);
reviewRouter.get(
  '/claims/:id/ai-job',
  staff,
  route(async (req, res) => {
    sendSuccess(res, await reviewerJobStatus(id(req)));
  }),
);
reviewRouter.get(
  '/claims/:id/actions',
  staff,
  route(async (req, res) => {
    sendSuccess(res, await listActions(id(req)));
  }),
);
reviewRouter.post(
  '/claims/:id/actions',
  staff,
  route(async (req, res) => {
    sendCreated(res, await addAction(req.actor!, id(req), ReviewActionInputSchema.parse(req.body)));
  }),
);
reviewRouter.get(
  '/claims/:id/requests',
  claimUsers,
  route(async (req, res) => {
    sendSuccess(res, await listRequests(req.actor!, id(req)));
  }),
);
reviewRouter.post(
  '/claims/:id/requests',
  staff,
  route(async (req, res) => {
    const requestId = await createRequest(
      req.actor!,
      id(req),
      CreateInformationRequestSchema.parse(req.body),
    );
    sendCreated(res, { id: requestId });
  }),
);
reviewRouter.post(
  '/claims/:id/requests/:requestId/respond',
  requireHospitalDesk,
  route(async (req, res) => {
    const requestId = UuidSchema.parse(req.params.requestId);
    sendSuccess(
      res,
      await respondToRequest(
        req.actor!,
        id(req),
        requestId,
        RespondToRequestSchema.parse(req.body),
      ),
    );
  }),
);
reviewRouter.get(
  '/claims/:id/audit',
  claimUsers,
  route(async (req, res) => {
    sendSuccess(res, await auditTimeline(req.actor!, id(req)));
  }),
);
reviewRouter.get(
  '/notifications',
  claimUsers,
  route(async (req, res) => {
    sendSuccess(res, await listNotifications(req.actor!));
  }),
);
reviewRouter.post(
  '/notifications/:id/read',
  claimUsers,
  route(async (req, res) => {
    sendSuccess(res, await markNotificationRead(req.actor!, id(req)));
  }),
);
