import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env['APP_BASE_URL'] ?? process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  ...(process.env['CI'] ? { workers: 1 } : {}),
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // In CI, start the Next.js dev server if not already running
  ...(process.env['CI']
    ? {
        webServer: {
          command: 'pnpm start',
          url: BASE_URL,
          reuseExistingServer: false,
          timeout: 120 * 1000,
          env: {
            DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/testdb',
            DIRECT_URL: process.env['DIRECT_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/testdb',
            AUTH_SECRET: process.env['AUTH_SECRET'] ?? 'ci-test-secret-minimum-32-chars-long!!',
            GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'] ?? 'fake-google-id',
            GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'] ?? 'fake-google-secret',
            GITHUB_CLIENT_ID: process.env['GITHUB_CLIENT_ID'] ?? 'fake-github-id',
            GITHUB_CLIENT_SECRET: process.env['GITHUB_CLIENT_SECRET'] ?? 'fake-github-secret',
            AUTH_URL: BASE_URL,
            CRON_SECRET: process.env['CRON_SECRET'] ?? 'fake-cron-secret',
            APP_BASE_URL: BASE_URL,
            NEXT_PUBLIC_POSTHOG_KEY: process.env['NEXT_PUBLIC_POSTHOG_KEY'] ?? 'phx_test',
            NEXT_PUBLIC_POSTHOG_HOST: process.env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://app.posthog.com',
          },
        },
      }
    : {}),
});
