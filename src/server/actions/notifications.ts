'use server';
/**
 * Notification server actions — Phase 6.
 * All accept (input, ctx: { actor: User }) and return Result<T, ServerActionError>.
 */
import { prisma } from '@/server/db/client';
import { mapNotificationRow } from '@/server/db/notification-mappers';
import type { Notification, Result, ServerActionError, User } from '@/types/domain';
import {
  listNotificationsSchema,
  markNotificationReadSchema,
  markAllNotificationsReadSchema,
} from '@/lib/zod/notifications';

type ActionCtx = { actor: User };

function validationError(message: string, field?: string): Result<never, ServerActionError> {
  const base = { code: 'validation_failed' as const, message };
  return { ok: false, error: field !== undefined ? { ...base, field } : base };
}

// ============================================================================
// listNotifications
// ============================================================================

/**
 * Returns the last 20 notifications for the current user (sorted by
 * created_at DESC) plus the total unread count (which may exceed 20).
 */
export async function listNotifications(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ items: Notification[]; unreadCount: number }>> {
  const parsed = listNotificationsSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  try {
    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: ctx.actor.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.notification.count({
        where: { userId: ctx.actor.id, readAt: null },
      }),
    ]);

    return {
      ok: true,
      data: {
        items: rows.map(mapNotificationRow),
        unreadCount,
      },
    };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to list notifications.' } };
  }
}

// ============================================================================
// markNotificationRead
// ============================================================================

/**
 * Mark a single notification as read. Recipient-only.
 * No-ops if already read (sets read_at only when null).
 */
export async function markNotificationRead(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ ok: true }>> {
  const parsed = markNotificationReadSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    return validationError(err?.message ?? 'Validation failed', err?.path[0]?.toString());
  }

  const { id } = parsed.data;

  try {
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, error: { code: 'not_found', message: 'Notification not found.' } };
    }

    // Recipient-only check (SPEC §9)
    if (existing.userId !== ctx.actor.id) {
      return { ok: false, error: { code: 'forbidden', message: 'You may only read your own notifications.' } };
    }

    // Only update if not already read
    if (existing.readAt === null) {
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }

    return { ok: true, data: { ok: true } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to mark notification as read.' } };
  }
}

// ============================================================================
// markAllNotificationsRead
// ============================================================================

/**
 * Mark all unread notifications as read up to (and including) upToCreatedAt.
 * The boundary prevents notifications that arrived after the user loaded the
 * list from being silently marked read (SPEC §3).
 *
 * Returns { ok: true, markedCount } — the number of rows actually updated.
 */
export async function markAllNotificationsRead(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ ok: true; markedCount: number }>> {
  const parsed = markAllNotificationsReadSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    return validationError(err?.message ?? 'Validation failed', err?.path[0]?.toString());
  }

  const { upToCreatedAt } = parsed.data;
  const boundary = new Date(upToCreatedAt);

  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: ctx.actor.id,
        readAt: null,
        createdAt: { lte: boundary },
      },
      data: { readAt: new Date() },
    });

    return { ok: true, data: { ok: true, markedCount: result.count } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to mark all notifications as read.' } };
  }
}
