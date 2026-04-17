/**
 * Integration tests for FR-28: WAU admin view.
 * Seeds users with sessions at different time offsets and verifies adminGetWau
 * returns correct wauCount and totalMembers.
 *
 * SPEC §13.5 skeleton: 3 members + 1 admin, sessions at 1d, 3d, 10d ago.
 * Expected: wauCount=2 (1d + 3d are within window), totalMembers=4.
 */
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import {
  createAdmin,
  createMember,
  seedSessionLog,
  resetDb,
  resetDbClient,
  getDb,
  daysAgo,
} from '../support/fixtures';
import { resetPrismaClient } from '@/server/db/client';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15').start();
  const connectionUri = container.getConnectionUri();

  process.env['DATABASE_URL'] = connectionUri;
  process.env['DIRECT_URL'] = connectionUri;

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
// FR-28: adminGetWau returns correct counts
// ============================================================================

describe('FR-28: adminGetWau returns correct WAU counts', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('SPEC §13.5 skeleton — wauCount=2, totalMembers=4', async () => {
    const { adminGetWau } = await import('@/server/actions/admin');

    const admin = await createAdmin('admin@wau-test.com');
    const u1 = await createMember('u1@wau-test.com');
    const u2 = await createMember('u2@wau-test.com');
    const u3 = await createMember('u3@wau-test.com');

    // u1: session 1 day ago — within 7-day window
    await seedSessionLog({ userId: u1.id, provider: 'google', createdAt: new Date(daysAgo(1)) });
    // u2: session 3 days ago — within 7-day window
    await seedSessionLog({ userId: u2.id, provider: 'github', createdAt: new Date(daysAgo(3)) });
    // u3: session 10 days ago — outside 7-day window
    await seedSessionLog({ userId: u3.id, provider: 'google', createdAt: new Date(daysAgo(10)) });

    const result = await adminGetWau({}, { actor: admin });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.wauCount).toBe(2);
    expect(result.data.totalMembers).toBe(4); // 3 members + 1 admin
  });

  test('multiple sessions from same user in 7 days count as 1 (DISTINCT)', async () => {
    const { adminGetWau } = await import('@/server/actions/admin');

    const admin = await createAdmin('admin@wau-distinct.com');
    const u1 = await createMember('u1@wau-distinct.com');

    // 3 sessions from same user in 7-day window
    await seedSessionLog({ userId: u1.id, provider: 'google', createdAt: new Date(daysAgo(1)) });
    await seedSessionLog({ userId: u1.id, provider: 'google', createdAt: new Date(daysAgo(2)) });
    await seedSessionLog({ userId: u1.id, provider: 'google', createdAt: new Date(daysAgo(3)) });

    const result = await adminGetWau({}, { actor: admin });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Only 1 DISTINCT user, even though there are 3 session rows
    expect(result.data.wauCount).toBe(1);
    expect(result.data.totalMembers).toBe(2); // admin + u1
  });

  test('non-admin actor receives forbidden error', async () => {
    const { adminGetWau } = await import('@/server/actions/admin');
    const member = await createMember('m@forbidden-test.com');

    const result = await adminGetWau({}, { actor: member });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('forbidden');
  });

  test('wauWindow.start is approximately 7 days ago', async () => {
    const { adminGetWau } = await import('@/server/actions/admin');
    const admin = await createAdmin('admin@window-test.com');

    const result = await adminGetWau({}, { actor: admin });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const windowStart = new Date(result.data.wauWindow.start);
    const now = new Date();
    const diffMs = now.getTime() - windowStart.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Should be approximately 7 days (within a 1-minute tolerance)
    expect(diffDays).toBeGreaterThan(6.999);
    expect(diffDays).toBeLessThan(7.001);
  });

  test('inactive users are excluded from totalMembers', async () => {
    const { adminGetWau } = await import('@/server/actions/admin');
    const { deactivateUser } = await import('../support/fixtures');

    const admin = await createAdmin('admin@inactive-test.com');
    const active = await createMember('active@inactive-test.com');
    const inactive = await createMember('inactive@inactive-test.com');

    await deactivateUser(inactive);

    const result = await adminGetWau({}, { actor: admin });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only admin + active member (2 active users)
    expect(result.data.totalMembers).toBe(2);
  });
});
