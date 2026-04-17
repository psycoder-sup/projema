/**
 * Notification service helpers.
 * Phase 6 implementation.
 *
 * These helpers are called from server actions and cron jobs.
 * All helpers that modify data accept a Prisma TransactionClient so they
 * participate in the caller's transaction.
 */
import type { Prisma } from '@prisma/client';

// ============================================================================
// createAssignedNotification
// ============================================================================

/**
 * Insert a notification of kind='assigned' for the given user.
 * Called from createTodo / updateTodo when an assignee (other than the actor)
 * is set.
 */
export async function createAssignedNotification(
  tx: Prisma.TransactionClient,
  opts: { userId: string; targetTodoId: string; triggeredByUserId: string },
): Promise<void> {
  await tx.notification.create({
    data: {
      userId: opts.userId,
      kind: 'assigned',
      targetTodoId: opts.targetTodoId,
      triggeredByUserId: opts.triggeredByUserId,
    },
  });
}

// ============================================================================
// createCommentOnAssignedNotification
// ============================================================================

/**
 * Insert a notification of kind='comment_on_assigned' for the todo assignee.
 * Called from postComment when the todo has an assignee and the assignee is
 * not the comment author.
 */
export async function createCommentOnAssignedNotification(
  tx: Prisma.TransactionClient,
  opts: { userId: string; targetTodoId: string; triggeredByUserId: string },
): Promise<void> {
  await tx.notification.create({
    data: {
      userId: opts.userId,
      kind: 'comment_on_assigned',
      targetTodoId: opts.targetTodoId,
      triggeredByUserId: opts.triggeredByUserId,
    },
  });
}

// ============================================================================
// upsertDueSoonNotification
// ============================================================================

/**
 * Insert a due_soon notification, deduped via the partial unique index
 * notifications_due_soon_unique.
 *
 * Returns { created: true } when a new row was inserted, { created: false }
 * when the index conflict prevented insertion (idempotent).
 */
export async function upsertDueSoonNotification(
  tx: Prisma.TransactionClient,
  opts: { userId: string; targetTodoId: string },
): Promise<{ created: boolean }> {
  // Use raw SQL so we can use ON CONFLICT DO NOTHING and RETURNING to detect
  // whether an insert actually occurred.
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO notifications (user_id, kind, target_todo_id)
    VALUES (${opts.userId}::uuid, 'due_soon', ${opts.targetTodoId}::uuid)
    ON CONFLICT (user_id, target_todo_id, kind) WHERE kind = 'due_soon'
    DO NOTHING
    RETURNING id
  `;
  return { created: rows.length > 0 };
}
