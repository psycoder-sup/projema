'use server';
/**
 * Admin server actions.
 * All actions accept (input, ctx) where ctx.actor is the authenticated user.
 * In production, withSession() resolves the actor from the Auth.js session.
 * In tests, the actor is passed directly.
 */
import { prisma } from '@/server/db/client';
import type { AllowlistEntry, Result, User } from '@/types/domain';

export type WauData = {
  totalMembers: number;
  wauCount: number;
  wauWindow: { start: string; end: string };
};
import {
  addAllowlistEmailSchema,
  removeAllowlistEmailSchema,
  deactivateUserSchema,
} from '@/lib/zod/admin';

type ActionCtx = { actor: User };

// ============================================================================
// addAllowlistEmail
// ============================================================================

export async function addAllowlistEmail(
  input: { email: string },
  ctx: ActionCtx
): Promise<Result<{ entry: AllowlistEntry }>> {
  // Auth guard
  if (!ctx.actor.isActive) {
    return { ok: false, error: { code: 'unauthorized', message: 'Account is inactive.' } };
  }
  // Role guard
  if (ctx.actor.role !== 'admin') {
    return { ok: false, error: { code: 'forbidden', message: 'Only admins can manage the allowlist.' } };
  }

  // Zod parse
  const parsed = addAllowlistEmailSchema.safeParse(input);
  if (!parsed.success) {
    const fieldRaw = parsed.error.errors[0]?.path[0]?.toString();
    const baseError = {
      code: 'validation_failed' as const,
      message: parsed.error.errors[0]?.message ?? 'Validation failed.',
    };
    return {
      ok: false,
      error: fieldRaw !== undefined ? { ...baseError, field: fieldRaw } : baseError,
    };
  }

  const { email } = parsed.data;

  try {
    const raw = await prisma.allowlistEntry.create({
      data: {
        email,
        addedByUserId: ctx.actor.id,
      },
    });
    return {
      ok: true,
      data: {
        entry: {
          id: raw.id,
          email: raw.email,
          addedByUserId: raw.addedByUserId,
          addedAt: raw.addedAt,
        },
      },
    };
  } catch (err: unknown) {
    // Prisma unique constraint violation → P2002
    if (isUniqueConstraintError(err)) {
      return { ok: false, error: { code: 'conflict', message: 'Email is already in the allowlist.' } };
    }
    return { ok: false, error: { code: 'internal_error', message: 'Failed to add email.' } };
  }
}

// ============================================================================
// removeAllowlistEmail
// ============================================================================

export async function removeAllowlistEmail(
  input: { entryId: string },
  ctx: ActionCtx
): Promise<Result<{ removed: boolean }>> {
  if (!ctx.actor.isActive) {
    return { ok: false, error: { code: 'unauthorized', message: 'Account is inactive.' } };
  }
  if (ctx.actor.role !== 'admin') {
    return { ok: false, error: { code: 'forbidden', message: 'Only admins can manage the allowlist.' } };
  }

  const parsed = removeAllowlistEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'validation_failed', message: parsed.error.errors[0]?.message ?? 'Validation failed.' },
    };
  }

  const existing = await prisma.allowlistEntry.findUnique({ where: { id: parsed.data.entryId } });
  if (!existing) {
    return { ok: false, error: { code: 'not_found', message: 'Allowlist entry not found.' } };
  }

  await prisma.allowlistEntry.delete({ where: { id: parsed.data.entryId } });
  return { ok: true, data: { removed: true } };
}

// ============================================================================
// deactivateUser
// ============================================================================

export async function deactivateUser(
  input: { userId: string },
  ctx: ActionCtx
): Promise<Result<{ deactivated: boolean }>> {
  if (!ctx.actor.isActive) {
    return { ok: false, error: { code: 'unauthorized', message: 'Account is inactive.' } };
  }
  if (ctx.actor.role !== 'admin') {
    return { ok: false, error: { code: 'forbidden', message: 'Only admins can deactivate users.' } };
  }

  const parsed = deactivateUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'validation_failed', message: parsed.error.errors[0]?.message ?? 'Validation failed.' },
    };
  }

  const { userId } = parsed.data;

  // Check if target is an admin
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return { ok: false, error: { code: 'not_found', message: 'User not found.' } };
  }

  // Refuse if target is the last active admin
  if (target.role === 'admin') {
    const activeAdminCount = await prisma.user.count({
      where: { role: 'admin', isActive: true },
    });
    if (activeAdminCount <= 1) {
      return {
        ok: false,
        error: { code: 'cannot_delete_last_admin', message: 'Cannot deactivate the last active admin.' },
      };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  return { ok: true, data: { deactivated: true } };
}

// ============================================================================
// adminGetWau — FR-28
// ============================================================================

/**
 * Returns Weekly Active Users stats for the admin dashboard.
 * Admin-only. Non-admin returns `forbidden`.
 *
 * - totalMembers: count of users WHERE is_active = true.
 * - wauCount: count(DISTINCT user_id) from sessions_log WHERE created_at >= now() - 7 days.
 * - wauWindow: { start: (now-7d).toISO(), end: now.toISO() }.
 */
export async function adminGetWau(
  _input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<WauData>> {
  if (!ctx.actor.isActive) {
    return { ok: false, error: { code: 'unauthorized', message: 'Account is inactive.' } };
  }
  if (ctx.actor.role !== 'admin') {
    return { ok: false, error: { code: 'forbidden', message: 'Admin access required.' } };
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalMembers, wauResult] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      // DISTINCT user_id count via groupBy+count or raw query
      prisma.sessionsLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    return {
      ok: true,
      data: {
        totalMembers,
        wauCount: wauResult.length,
        wauWindow: {
          start: sevenDaysAgo.toISOString(),
          end: now.toISOString(),
        },
      },
    };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to fetch WAU data.' } };
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}
