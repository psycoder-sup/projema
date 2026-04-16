/**
 * Unit test: Zod env schema validates required environment variables.
 */
import { describe, expect, it } from 'vitest';
import { envSchema } from '../../src/lib/env';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
  AUTH_SECRET: 'super-secret-value-at-least-32-chars-long',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GITHUB_CLIENT_ID: 'github-client-id',
  GITHUB_CLIENT_SECRET: 'github-client-secret',
  AUTH_URL: 'http://localhost:3000',
  POSTHOG_API_KEY: 'phx_test_key',
  NEXT_PUBLIC_POSTHOG_KEY: 'phx_public_key',
  NEXT_PUBLIC_POSTHOG_HOST: 'https://app.posthog.com',
  APP_BASE_URL: 'http://localhost:3000',
  CRON_SECRET: 'cron-secret-value',
};

describe('envSchema', () => {
  it('accepts a complete valid env', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.errors.map((e) => e.path[0]);
      expect(fields).toContain('DATABASE_URL');
    }
  });

  it('rejects a missing AUTH_SECRET', () => {
    const { AUTH_SECRET: _, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects a missing CRON_SECRET', () => {
    const { CRON_SECRET: _, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('uses UTC as default for ORG_TIMEZONE', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ORG_TIMEZONE).toBe('UTC');
    }
  });

  it('accepts an explicit ORG_TIMEZONE value', () => {
    const result = envSchema.safeParse({ ...validEnv, ORG_TIMEZONE: 'America/New_York' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ORG_TIMEZONE).toBe('America/New_York');
    }
  });
});
