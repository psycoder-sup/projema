/**
 * Due-soon notification sweep job.
 * Phase 6 implementation.
 *
 * Scans all non-done todos with a due_date on or before tomorrow (in the
 * org's configured timezone) that have an assignee. For each such todo,
 * inserts a due_soon notification row using ON CONFLICT DO NOTHING on the
 * partial unique index — ensuring idempotency across cron runs.
 */
import { prisma } from '@/server/db/client';
import { env } from '@/lib/env';
import { upsertDueSoonNotification } from '@/server/services/notifications';

/**
 * Sweep todos that are due today or earlier (per ORG_TIMEZONE) and create
 * due_soon notifications for their assignees. Idempotent — safe to run
 * multiple times.
 */
export async function sweepDueSoonNotifications(): Promise<{ notificationsCreated: number }> {
  const orgTimezone = env.ORG_TIMEZONE;

  // Find todos that are:
  //   - not done
  //   - have an assignee
  //   - due on or before tomorrow midnight in the org timezone
  //
  // We use a raw query to leverage the AT TIME ZONE semantics exactly as
  // described in SPEC §3.
  const todos = await prisma.$queryRaw<
    { id: string; assignee_user_id: string; due_date: Date }[]
  >`
    SELECT id, assignee_user_id, due_date
    FROM todos
    WHERE status <> 'done'
      AND assignee_user_id IS NOT NULL
      AND due_date IS NOT NULL
      AND due_date <= (date_trunc('day', now() AT TIME ZONE ${orgTimezone}) + INTERVAL '1 day')::date
  `;

  let notificationsCreated = 0;

  for (const todo of todos) {
    await prisma.$transaction(async (tx) => {
      const result = await upsertDueSoonNotification(tx, {
        userId: todo.assignee_user_id,
        targetTodoId: todo.id,
      });
      if (result.created) {
        notificationsCreated++;
      }
    });
  }

  return { notificationsCreated };
}
