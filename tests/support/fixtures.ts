/**
 * Test fixtures for integration and unit tests.
 * Uses the Prisma client configured via environment variables.
 */
import { PrismaClient } from '@prisma/client';
import type { User } from '@/types/domain';

// Use the module-level client (env vars set by test setup)
const db = new PrismaClient();

export { db };

/**
 * Truncate all tables in dependency order so each test starts fresh.
 */
export async function resetDb(): Promise<void> {
  await db.$transaction([
    db.sessionsLog.deleteMany(),
    db.allowlistEntry.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.verificationToken.deleteMany(),
    db.user.deleteMany(),
  ]);
}

let adminCounter = 0;
let memberCounter = 0;

/**
 * Create a user with role='admin'.
 */
export async function createAdmin(email?: string): Promise<User> {
  adminCounter++;
  const resolvedEmail = email ?? `admin-${adminCounter}@example.com`;
  const raw = await db.user.create({
    data: {
      email: resolvedEmail,
      displayName: `Admin ${adminCounter}`,
      avatarUrl: null,
      role: 'admin',
      isActive: true,
    },
  });
  return {
    id: raw.id,
    email: raw.email!,
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl,
    role: raw.role as 'admin' | 'member',
    isActive: raw.isActive,
    lastSeenAt: raw.lastSeenAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Create a user with role='member'.
 */
export async function createMember(email?: string): Promise<User> {
  memberCounter++;
  const resolvedEmail = email ?? `member-${memberCounter}@example.com`;
  const raw = await db.user.create({
    data: {
      email: resolvedEmail,
      displayName: `Member ${memberCounter}`,
      avatarUrl: null,
      role: 'member',
      isActive: true,
    },
  });
  return {
    id: raw.id,
    email: raw.email!,
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl,
    role: raw.role as 'admin' | 'member',
    isActive: raw.isActive,
    lastSeenAt: raw.lastSeenAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Insert an allowlist_entries row.
 */
export async function seedAllowlist(email: string, addedByUserId: string): Promise<void> {
  await db.allowlistEntry.create({
    data: {
      email: email.toLowerCase(),
      addedByUserId,
    },
  });
}

/**
 * Insert a sessions_log row.
 */
export async function seedSessionLog({
  userId,
  provider,
  createdAt,
}: {
  userId: string;
  provider: 'google' | 'github';
  createdAt?: Date;
}): Promise<void> {
  await db.sessionsLog.create({
    data: {
      userId,
      provider,
      createdAt: createdAt ?? new Date(),
    },
  });
}

/**
 * Deactivate a user by setting isActive=false.
 */
export async function deactivateUser(user: User): Promise<void> {
  await db.user.update({
    where: { id: user.id },
    data: { isActive: false },
  });
}

/**
 * Return ISO string N days from now.
 */
export function addDaysISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

/**
 * Return ISO string N hours from now.
 */
export function addHoursISO(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d.toISOString();
}

/**
 * Return ISO string N days in the past.
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
