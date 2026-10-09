import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Prisma Client Wiring
 * Singleton instance managing connection to PostgreSQL with pgvector.
 * Adheres to Sole Write Authority (PRD §5.1) — Express Core API is the only service that writes to the database.
 */
export const prisma = new PrismaClient({
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

// Attach query logging in development mode without exposing sensitive parameters
if (env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$on('query' as any, (e: any) => {
    logger.debug(`[Prisma Query] ${e.query} (${e.duration}ms)`);
  });
}

// Log database errors through structured logger
// eslint-disable-next-line @typescript-eslint/no-explicit-any
prisma.$on('error' as any, (e: any) => {
  logger.error(`[Prisma Error] ${e.message}`, undefined, { target: e.target });
});

/**
 * Connects to PostgreSQL and verifies the connection with a quick verification query.
 * Fails fast if the database is unreachable.
 */
export async function connectDatabase(): Promise<void> {
  try {
    logger.info('Connecting to PostgreSQL database...', {
      environment: env.NODE_ENV,
    });
    await prisma.$connect();
    // Verification query to ensure the connection pool is actively established
    await prisma.$queryRawUnsafe('SELECT 1');
    logger.info('PostgreSQL connection established and verified successfully.');
  } catch (error) {
    logger.error('Failed to establish connection to PostgreSQL database.', error, {
      hint: 'Ensure Docker container is running: docker compose -f infra/docker-compose.yml up -d',
    });
    throw error;
  }
}

/**
 * Disconnects the Prisma client cleanly during application shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('PostgreSQL connection pool closed cleanly.');
  } catch (error) {
    logger.error('Error while closing PostgreSQL connection pool.', error);
    throw error;
  }
}

/**
 * Health check helper returning boolean status of the database connection.
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { UserRole } from '@prisma/client';
export default prisma;
