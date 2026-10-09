import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Core API listening on port ${env.PORT}`, {
    port: env.PORT,
    environment: env.NODE_ENV,
    healthEndpoint: `http://localhost:${env.PORT}/health`,
  });
});

// Graceful Shutdown Handlers
function shutdown(signal: string) {
  logger.info(`Received ${signal}. Closing HTTP server gracefully...`, { signal });
  server.close(() => {
    logger.info('HTTP server closed successfully.', { signal });
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down', undefined, { signal });
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
