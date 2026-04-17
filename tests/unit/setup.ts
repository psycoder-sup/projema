/**
 * Unit test setup file.
 * Runs before each unit test file.
 */

// Set test env vars before any modules are imported
// NODE_ENV is read-only in strict mode; it's already set to 'test' by vitest
Object.assign(process.env, {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
  AUTH_SECRET: 'test-secret-minimum-32-chars-long!!',
  GOOGLE_CLIENT_ID: 'test-google-id',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  AUTH_URL: 'http://localhost:3000',
  POSTHOG_API_KEY: 'phx_test',
  NEXT_PUBLIC_POSTHOG_KEY: 'phx_test',
  NEXT_PUBLIC_POSTHOG_HOST: 'https://app.posthog.com',
  APP_BASE_URL: 'http://localhost:3000',
  CRON_SECRET: 'test-cron-secret',
});
