import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './db/prisma';
import { logger } from './utils/logger';

/**
 * Server Startup Routine
 * Enforces startup database connectivity verification and graceful shutdown lifecycle.
 */
async function startServer(): Promise<void> {
  try {
    // 1. Verify database connectivity before accepting HTTP traffic (Fail-Fast)
    await connectDatabase();

    // 2. Build configured Express application instance
    const app = createApp();

    // 3. Start listening for incoming HTTP connections
    const server = app.listen(env.PORT, () => {
      logger.info(`Core API listening on port ${env.PORT}`, {
        port: env.PORT,
        environment: env.NODE_ENV,
        healthEndpoint: `http://localhost:${env.PORT}/health`,
      });
    });

    // 4. Graceful Shutdown Routine
    async function shutdown(signal: string): Promise<void> {
      logger.info(`Received ${signal}. Initiating graceful shutdown...`, { signal });

      // Stop accepting new requests and finish inflight connections
      server.close(async () => {
        logger.info('HTTP server closed. Disconnecting from database...');
        try {
          await disconnectDatabase();
          logger.info('Graceful shutdown completed successfully.');
          process.exit(0);
        } catch (dbError) {
          logger.error('Failed to cleanly disconnect database during shutdown', dbError);
          process.exit(1);
        }
      });

      // Force terminate if shutdown hangs beyond 10 seconds
      setTimeout(() => {
        logger.error('Shutdown timed out after 10 seconds, forcefully terminating process', undefined, { signal });
        process.exit(1);
      }, 10000).unref();
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (fatalError) {
    logger.error('Fatal error during API startup sequence. Terminating process.', fatalError);
    process.exit(1);
  }
}

void startServer();
