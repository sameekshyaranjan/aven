import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLoggerMiddleware } from './middleware/request-logger';
import { sendSuccess } from './utils/response';

/**
 * Application Factory
 * Constructs and configures the Express application instance without binding to a network port.
 * This separates server startup from app definition, making testing fast and isolated.
 */
export function createApp(): Application {
  const app: Application = express();

  // Observability & Security Middleware
  app.use(helmet());
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health Probe Route
  app.get('/health', (_req: Request, res: Response) => {
    return sendSuccess(res, {
      status: 'ok',
      service: 'aven-api',
      version: '0.1.0',
      uptime: Math.floor(process.uptime()),
    });
  });

  // 404 Catch-All Middleware (captures unmatched routes)
  app.use(notFoundHandler);

  // Global Centralized Error Handling Middleware (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;

