import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLoggerMiddleware } from './middleware/request-logger';

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
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'aven-api',
      version: '0.1.0',
      requestId: req.id,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

export default createApp;
