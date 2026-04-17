/**
 * Allowlist check logic and sign-in callback handler.
 * Phase 1 implementation.
 */
import { prisma } from '@/server/db/client';
import type { User } from '@/types/domain';

export type SignInInput = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  provider: 'google' | 'github';
};

export type SignInResult =
  | { ok: true; user: User }
  | { ok: false; error: { code: 'not_allowlisted'; message: string } };

/**
 * Core sign-in callback logic:
 * 1. Empty DB (no users, no allowlist) → create first user as admin.
 * 2. Email on allowlist → upsert as member, return ok.
 * 3. Otherwise → return not_allowlisted error.
 *
 * The bootstrap check + user create run in a serializable transaction to
 * prevent two concurrent first-signups from both becoming admin.
 */
export async function handleSignInCallback(input: SignInInput): Promise<SignInResult> {
  const email = input.email.toLowerCase();

  // Check if this is the bootstrap case (empty users AND empty allowlist)
  const [userCount, allowlistCount] = await prisma.$transaction([
    prisma.user.count(),
    prisma.allowlistEntry.count(),
  ]);

  if (userCount === 0 && allowlistCount === 0) {
    // Bootstrap: first user becomes admin in a serializable transaction
    const user = await prisma.$transaction(
      async (tx) => {
        // Re-check inside transaction to prevent race
        const count = await tx.user.count();
        if (count > 0) {
          // Another concurrent signup beat us — fall through
          return null;
        }
        return tx.user.create({
          data: {
            email,
            displayName: input.displayName,
            avatarUrl: input.avatarUrl,
            role: 'admin',
            isActive: true,
          },
        });
      },
      { isolationLevel: 'Serializable' }
    );

    if (user) {
      return {
        ok: true,
        user: mapUser(user),
      };
    }
    // If user is null, another signup completed first — fall through to allowlist check
  }

  // Check allowlist (case-insensitive via lowercased storage)
  const entry = await prisma.allowlistEntry.findUnique({
    where: { email },
  });

  if (entry) {
    // Upsert user as member with latest displayName/avatar
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        role: 'member',
        isActive: true,
      },
      update: {
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
      },
    });
    return { ok: true, user: mapUser(user) };
  }

  // Check if user already exists (e.g. existing admin signing in)
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Existing user (e.g. admin) — allow sign-in, update display info
    const updated = await prisma.user.update({
      where: { email },
      data: {
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
      },
    });
    return { ok: true, user: mapUser(updated) };
  }

  return {
    ok: false,
    error: {
      code: 'not_allowlisted',
      message: 'Your account is not on the allowlist.',
    },
  };
}

/**
 * Record a sign-in event in sessions_log and update lastSeenAt.
 * Called by Auth.js events.signIn (and directly in tests).
 */
export async function recordSignIn({
  userId,
  provider,
}: {
  userId: string;
  provider: 'google' | 'github';
}): Promise<void> {
  await prisma.$transaction([
    prisma.sessionsLog.create({
      data: { userId, provider },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    }),
  ]);
}

// ============================================================================
// Internal helpers
// ============================================================================

type PrismaUser = {
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

function mapUser(raw: PrismaUser): User {
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
