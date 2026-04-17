'use server';
/**
 * Activity query actions — Phase 4.
 * listActivity returns the paginated activity event feed.
 */
import { prisma } from '@/server/db/client';
import type { ActivityEvent, ActivityEventKind, Result, ServerActionError, User } from '@/types/domain';
import { z } from 'zod';

type ActionCtx = { actor: User };

// ============================================================================
// listActivity input schema
// ============================================================================

const listActivitySchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  before: z.string().datetime({ offset: true }).optional(),
});

// ============================================================================
// Mapper
// ============================================================================

type PrismaActivityEventRow = {
  id: string;
  actorUserId: string;
  kind: string;
  targetTodoId: string | null;
  targetSprintId: string | null;
  payloadJson: unknown;
  createdAt: Date;
};

function mapActivityEventRow(raw: PrismaActivityEventRow): ActivityEvent {
  return {
    id: raw.id,
    actorUserId: raw.actorUserId,
    kind: raw.kind as ActivityEventKind,
    targetTodoId: raw.targetTodoId,
    targetSprintId: raw.targetSprintId,
    payload: raw.payloadJson != null
      ? (raw.payloadJson as Record<string, unknown>)
      : null,
    createdAt: raw.createdAt,
  };
}

// ============================================================================
// listActivity
// ============================================================================

/**
 * List the most recent activity events, newest first.
 * Supports cursor pagination via `before` (ISO timestamp of the oldest event
 * already visible to the client). Default limit is 15 for the dashboard
 * Team Activity card (FR-20).
 */
export async function listActivity(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ data: ActivityEvent[] }, ServerActionError>> {
  const parsed = listActivitySchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    return {
      ok: false,
      error: { code: 'validation_failed', message: err?.message ?? 'Validation failed' },
    };
  }

  const limit = parsed.data.limit ?? 15;
  const before = parsed.data.before ? new Date(parsed.data.before) : undefined;

  try {
    const where = before ? { createdAt: { lt: before } } : {};
    const rows = await prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      ok: true,
      data: { data: rows.map(mapActivityEventRow) },
    };
  } catch {
    return {
      ok: false,
      error: { code: 'internal_error', message: 'Failed to list activity.' },
    };
  }
  void ctx;
}
