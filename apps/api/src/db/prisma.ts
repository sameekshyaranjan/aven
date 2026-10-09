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

// Attach query logging in development mode without exposing sensitive query data
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

export default prisma;
