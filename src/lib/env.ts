/**
 * Environment variable validation via Zod.
 * All required env vars are listed here with their expected types.
 * Import `env` in server-side code only — never expose to the browser.
 * For client-side vars, use NEXT_PUBLIC_ prefix and access via process.env directly.
 */
import { z } from 'zod';

export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),

  // Auth.js v5
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required'),
  AUTH_URL: z.string().url('AUTH_URL must be a valid URL').optional(),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),

  // PostHog
  POSTHOG_API_KEY: z.string().min(1, 'POSTHOG_API_KEY is required'),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1, 'NEXT_PUBLIC_POSTHOG_KEY is required'),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url('NEXT_PUBLIC_POSTHOG_HOST must be a valid URL'),

  // Application
  APP_BASE_URL: z.string().url('APP_BASE_URL must be a valid URL'),
  ORG_TIMEZONE: z.string().min(1).default('UTC'),

  // Cron
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),

  // Sentry (optional)
  SENTRY_ENABLED: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated environment variables.
 * This will throw at module load time if required variables are missing,
 * which surfaces config issues immediately on startup.
 *
 * In tests, set process.env before importing this module,
 * or use envSchema.safeParse() directly.
 */
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
function getEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // In test environments, don't crash on missing env vars
    if (process.env['NODE_ENV'] === 'test') {
      return envSchema.parse({
        DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/test',
        DIRECT_URL: process.env['DIRECT_URL'] ?? 'postgresql://localhost:5432/test',
        AUTH_SECRET: process.env['AUTH_SECRET'] ?? 'test-secret-minimum-32-chars-long!!',
        AUTH_URL: process.env['AUTH_URL'] ?? 'http://localhost:3000',
        GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'] ?? 'test-google-id',
        GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'] ?? 'test-google-secret',
        GITHUB_CLIENT_ID: process.env['GITHUB_CLIENT_ID'] ?? 'test-github-id',
        GITHUB_CLIENT_SECRET: process.env['GITHUB_CLIENT_SECRET'] ?? 'test-github-secret',
        POSTHOG_API_KEY: process.env['POSTHOG_API_KEY'] ?? 'phx_test',
        NEXT_PUBLIC_POSTHOG_KEY: process.env['NEXT_PUBLIC_POSTHOG_KEY'] ?? 'phx_test',
        NEXT_PUBLIC_POSTHOG_HOST:
          process.env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://app.posthog.com',
        APP_BASE_URL: process.env['APP_BASE_URL'] ?? 'http://localhost:3000',
        ORG_TIMEZONE: process.env['ORG_TIMEZONE'] ?? 'UTC',
        CRON_SECRET: process.env['CRON_SECRET'] ?? 'test-cron-secret',
        NODE_ENV: 'test',
      });
    }
    const errorMessages = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${errorMessages}`);
  }
  return result.data;
}

export const env = getEnv();
