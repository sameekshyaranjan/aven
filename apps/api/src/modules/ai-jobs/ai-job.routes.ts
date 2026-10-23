import { timingSafeEqual } from 'node:crypto';
import { AiCallbackSchema, AiHeartbeatSchema, UuidSchema } from '@aven/contracts';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../errors/app-error';
import { sendSuccess } from '../../utils/response';
import { acceptCallback, claimNextJob, heartbeat } from './ai-job.service';

const route =
  (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    run(req, res).catch(next);
  };

export const aiJobRouter = Router();
aiJobRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  const received = req.get('X-Aven-Internal-Token') ?? '';
  const actual = Buffer.from(env.AI_INTERNAL_TOKEN);
  const supplied = Buffer.from(received);
  if (actual.length !== supplied.length || !timingSafeEqual(actual, supplied))
    return next(new UnauthorizedError('Internal authentication required.'));
  next();
});

aiJobRouter.post(
  '/jobs/claim',
  route(async (_req, res) => {
    sendSuccess(res, await claimNextJob());
  }),
);
aiJobRouter.post(
  '/jobs/:id/heartbeat',
  route(async (req, res) => {
    const body = AiHeartbeatSchema.parse(req.body);
    sendSuccess(
      res,
      await heartbeat(
        UuidSchema.parse(req.params.id),
        body.attempt_generation,
        body.lease_token,
        body.stage,
      ),
    );
  }),
);
aiJobRouter.post(
  '/jobs/:id/callback',
  route(async (req, res) => {
    const body = AiCallbackSchema.parse(req.body);
    if (body.job_id !== UuidSchema.parse(req.params.id))
      throw new UnauthorizedError('AI job ID does not match.');
    sendSuccess(res, await acceptCallback(body));
  }),
);
