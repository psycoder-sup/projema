'use server';
/**
 * Admin server actions.
 * All actions accept (input, ctx) where ctx.actor is the authenticated user.
 * In production, withSession() resolves the actor from the Auth.js session.
 * In tests, the actor is passed directly.
 */
import { prisma } from '@/server/db/client';
import type { AllowlistEntry, Result, User } from '@/types/domain';
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
