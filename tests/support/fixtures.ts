/**
 * Test fixtures for integration and unit tests.
 * Uses the Prisma client configured via environment variables.
 *
 * IMPORTANT: Call resetDbClient() after setting DATABASE_URL in beforeAll,
 * then access the db via getDb() or the exported fixture functions.
 */
import { PrismaClient } from '@prisma/client';
import type { User } from '@/types/domain';

// Lazy client — created on first access so that beforeAll can set DATABASE_URL first.
let _db: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!_db) {
    _db = new PrismaClient();
  }
  return _db;
}

/**
 * Reset the lazy client. Call this after DATABASE_URL changes in beforeAll
 * so the next getDb() call creates a fresh client with the new URL.
 */
export function resetDbClient(): void {
  if (_db) {
    void _db.$disconnect();
    _db = undefined;
  }
}

/**
 * Truncate all tables in dependency order so each test starts fresh.
 */
export async function resetDb(): Promise<void> {
  const client = getDb();
  await client.$transaction([
    client.sessionsLog.deleteMany(),
    client.allowlistEntry.deleteMany(),
    client.session.deleteMany(),
    client.account.deleteMany(),
    client.verificationToken.deleteMany(),
    client.user.deleteMany(),
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
  const raw = await getDb().user.create({
    data: {
      email: resolvedEmail,
      displayName: `Admin ${adminCounter}`,
      avatarUrl: null,
      role: 'admin',
      isActive: true,
    },
  });
  return mapUser(raw);
}

/**
 * Create a user with role='member'.
 */
export async function createMember(email?: string): Promise<User> {
  memberCounter++;
  const resolvedEmail = email ?? `member-${memberCounter}@example.com`;
  const raw = await getDb().user.create({
    data: {
      email: resolvedEmail,
      displayName: `Member ${memberCounter}`,
      avatarUrl: null,
      role: 'member',
      isActive: true,
    },
  });
  return mapUser(raw);
}

/**
 * Insert an allowlist_entries row.
 */
export async function seedAllowlist(email: string, addedByUserId: string): Promise<void> {
  await getDb().allowlistEntry.create({
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
  await getDb().sessionsLog.create({
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
  await getDb().user.update({
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

// ============================================================================
// Internal helpers
// ============================================================================

type PrismaRawUser = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapUser(raw: PrismaRawUser): User {
  return {
    id: raw.id,
    email: raw.email ?? '',
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl,
    role: raw.role as 'admin' | 'member',
    isActive: raw.isActive,
    lastSeenAt: raw.lastSeenAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
