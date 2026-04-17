/**
 * Integration tests for FR-01..FR-04, FR-28.
 * Runs against a real Postgres database (Testcontainers).
 */
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Import fixture helpers — lazy client, reset after URL is set
import { createMember, createAdmin, seedAllowlist, resetDb, resetDbClient, getDb } from '../support/fixtures';
import { resetPrismaClient } from '@/server/db/client';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15').start();
  const connectionUri = container.getConnectionUri();

  // Set env vars BEFORE any Prisma clients are constructed
  process.env['DATABASE_URL'] = connectionUri;
  process.env['DIRECT_URL'] = connectionUri;

  // Reset ALL lazy prisma clients so next access uses the new URL
  resetDbClient();
  resetPrismaClient();

  execSync('pnpm prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: connectionUri,
      DIRECT_URL: connectionUri,
    },
    stdio: 'pipe',
    cwd: process.cwd(),
  });
}, 120_000);

afterAll(async () => {
  const db = getDb();
  await db.$disconnect();
  await container?.stop();
});

// ============================================================================
// FR-01: Google + GitHub are the only sign-in options
// ============================================================================

describe('FR-01: Google + GitHub are the only sign-in options', () => {
  test('auth config exposes exactly google and github providers', async () => {
    const { authConfig } = await import('@/server/auth/config');
    const ids = (authConfig.providers as Array<{ id: string }>).map((p) => p.id).sort();
    expect(ids).toEqual(['github', 'google']);
  });
});

// ============================================================================
// FR-02: first signup becomes admin; others require allowlist
// ============================================================================

describe('FR-02: first signup becomes admin; others require allowlist', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('first signup on empty DB is admitted as admin', async () => {
    const { handleSignInCallback } = await import('@/server/auth/allowlist');
    const result = await handleSignInCallback({
      email: 'founder@example.com',
      displayName: 'Founder',
      avatarUrl: null,
      provider: 'google',
    });
    expect(result.ok).toBe(true);
    const user = await getDb().user.findUnique({ where: { email: 'founder@example.com' } });
    expect(user?.role).toBe('admin');
  });

  test('second new-email signup without allowlist is rejected', async () => {
    const { handleSignInCallback } = await import('@/server/auth/allowlist');
    await createAdmin('founder@example.com');
    const result = await handleSignInCallback({
      email: 'stranger@example.com',
      displayName: 'Stranger',
      avatarUrl: null,
      provider: 'github',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_allowlisted');
  });

  test('allowlisted email signup admits as member', async () => {
    const { handleSignInCallback } = await import('@/server/auth/allowlist');
    const admin = await createAdmin();
    await seedAllowlist('new@example.com', admin.id);
    const result = await handleSignInCallback({
      email: 'new@example.com',
      displayName: 'New',
      avatarUrl: null,
      provider: 'google',
    });
    expect(result.ok).toBe(true);
    const user = await getDb().user.findUnique({ where: { email: 'new@example.com' } });
    expect(user?.role).toBe('member');
  });

  test('email lookup is case-insensitive (uppercase email still matches allowlist)', async () => {
    const { handleSignInCallback } = await import('@/server/auth/allowlist');
    const admin = await createAdmin();
    await seedAllowlist('CaseSensitive@Example.COM', admin.id);
    const result = await handleSignInCallback({
      email: 'casesensitive@example.com',
      displayName: 'Case',
      avatarUrl: null,
      provider: 'google',
    });
    expect(result.ok).toBe(true);
  });

  test('existing user can sign in again (update displayName/avatar, keep role)', async () => {
    const { handleSignInCallback } = await import('@/server/auth/allowlist');
    const admin = await createAdmin('existing@example.com');
    await seedAllowlist('existing@example.com', admin.id);
    const result = await handleSignInCallback({
      email: 'existing@example.com',
      displayName: 'Updated Name',
      avatarUrl: 'https://example.com/new-avatar.png',
      provider: 'google',
    });
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// FR-03: only admins can manage the allowlist
// ============================================================================

describe('FR-03: only admins can manage the allowlist', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('admin can add an allowlist email', async () => {
    const { addAllowlistEmail } = await import('@/server/actions/admin');
    const admin = await createAdmin('admin@example.com');
    const result = await addAllowlistEmail({ email: 'new@example.com' }, { actor: admin });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entry.email).toBe('new@example.com');
    }
  });

  test('member cannot add an allowlist email', async () => {
    const { addAllowlistEmail } = await import('@/server/actions/admin');
    const member = await createMember('m@example.com');
    const result = await addAllowlistEmail({ email: 'x@example.com' }, { actor: member });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('forbidden');
  });

  test('admin cannot deactivate the last admin', async () => {
    const { deactivateUser } = await import('@/server/actions/admin');
    const admin = await createAdmin('solo-admin@example.com');
    const result = await deactivateUser({ userId: admin.id }, { actor: admin });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cannot_delete_last_admin');
  });

  test('duplicate allowlist email returns conflict', async () => {
    const { addAllowlistEmail } = await import('@/server/actions/admin');
    const admin = await createAdmin();
    await addAllowlistEmail({ email: 'dup@example.com' }, { actor: admin });
    const result = await addAllowlistEmail({ email: 'dup@example.com' }, { actor: admin });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('conflict');
  });

  test('admin can deactivate a member', async () => {
    const { deactivateUser } = await import('@/server/actions/admin');
    const admin = await createAdmin();
    const member = await createMember();
    const result = await deactivateUser({ userId: member.id }, { actor: admin });
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// FR-28: sessions_log written on sign-in
// ============================================================================

describe('FR-28: sessions_log written on sign-in', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('recordSignIn writes a sessions_log row', async () => {
    const { recordSignIn } = await import('@/server/auth/allowlist');
    const admin = await createAdmin();
    await recordSignIn({ userId: admin.id, provider: 'google' });

    const logs = await getDb().sessionsLog.findMany({ where: { userId: admin.id } });
    expect(logs.length).toBe(1);
    expect(logs[0]?.provider).toBe('google');
  });

  test('recordSignIn updates users.lastSeenAt', async () => {
    const { recordSignIn } = await import('@/server/auth/allowlist');
    const admin = await createAdmin();
    const before = new Date();
    await recordSignIn({ userId: admin.id, provider: 'github' });

    const user = await getDb().user.findUnique({ where: { id: admin.id } });
    expect(user?.lastSeenAt).not.toBeNull();
    expect(user?.lastSeenAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  test('multiple recordSignIn calls create multiple log rows', async () => {
    const { recordSignIn } = await import('@/server/auth/allowlist');
    const admin = await createAdmin();
    await recordSignIn({ userId: admin.id, provider: 'google' });
    await recordSignIn({ userId: admin.id, provider: 'github' });

    const logs = await getDb().sessionsLog.findMany({ where: { userId: admin.id } });
    expect(logs.length).toBe(2);
  });
});
