import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env before validating schema
dotenv.config();

const envSchema = z.object({
  // Server Environment
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // PostgreSQL Connection String
  DATABASE_URL: z
    .string({
      required_error: 'DATABASE_URL is required to connect to PostgreSQL.',
    })
    .min(10, 'DATABASE_URL must be a valid PostgreSQL connection string.'),

  // JWT Authentication Secrets
  JWT_SECRET: z
    .string({
      required_error: 'JWT_SECRET is required to sign session tokens.',
    })
    .min(32, 'JWT_SECRET must be at least 32 characters long for cryptographic security.'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(
      /^(?:[1-9]|[1-5][0-9])m$/,
      'JWT_EXPIRES_IN must be between 1m and 59m for a short-lived user session.',
    )
    .default('15m'),

  // Public API Abuse Protection
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  LOGIN_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
  PUBLIC_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(1),
  PUBLIC_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),

  // AI Advisory Service
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),

  // S3-compatible object storage (SeaweedFS in local development)
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_PORT: z.coerce.number().int().positive().default(9000),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  S3_BUCKET_NAME: z.string().default('aven-documents'),
  S3_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),

  // Background Job Queue
  JOB_LEASE_DURATION_SECONDS: z.coerce.number().int().positive().default(60),
  JOB_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
});

export type Env = z.infer<typeof envSchema>;

function loadAndValidateEnv(): Env {
  // During automated unit tests without a database, provide safe fallback defaults
  const isTest = process.env.NODE_ENV === 'test';

  const parseTarget = isTest
    ? {
        DATABASE_URL: 'postgresql://mock_user:mock_pass@localhost:5432/mock_db',
        JWT_SECRET: 'test_secret_must_be_minimum_32_characters_long_for_test',
        ...process.env,
      }
    : process.env;

  const result = envSchema.safeParse(parseTarget);

  if (!result.success) {
    console.error('\n============================================================');
    console.error('❌ [aven-api] Fatal Configuration Error: Invalid Environment Variables');
    console.error('============================================================');

    for (const issue of result.error.issues) {
      const field = issue.path.join('.');
      console.error(`  • ${field}: ${issue.message}`);
    }

    console.error(
      '\n👉 Please check your local apps/api/.env file against apps/api/.env.example.\n',
    );
    process.exit(1);
  }

  return result.data;
}

export const env: Env = loadAndValidateEnv();
export default env;
