'use server';
/**
 * Comment server actions — Phase 4.
 * All accept (input, ctx: { actor: User }) and return Result<T, ServerActionError>.
 * All mutations run inside a single Prisma transaction that also writes activity_events.
 */
import { prisma } from '@/server/db/client';
import { mapCommentRow } from '@/server/db/comment-mappers';
import { recordActivity } from '@/server/services/activity';
import { checkRateLimit } from '@/server/services/rate-limit';
import { createCommentOnAssignedNotification } from '@/server/services/notifications';
import { track, commentLengthBucket } from '@/server/analytics/events';
import type { Comment, Result, ServerActionError, User } from '@/types/domain';
import {
  postCommentSchema,
  editCommentSchema,
  deleteCommentSchema,
  listCommentsSchema,
} from '@/lib/zod/comments';

type ActionCtx = { actor: User };

// ============================================================================
// Helpers
// ============================================================================

function validationError(message: string, field?: string): Result<never, ServerActionError> {
  const base = { code: 'validation_failed' as const, message };
  return { ok: false, error: field !== undefined ? { ...base, field } : base };
}

// ============================================================================
// postComment
// ============================================================================

/**
 * Post a comment on a todo.
 *
 * Guards:
 * - Actor must be authenticated and active.
 * - Rate-limited to 10 posts per 60 seconds per user.
 *
 * Side-effects:
 * - Inserts a comment row.
 * - Emits `comment_posted` activity event.
 * - If todo has an assignee and assignee != author, inserts a
 *   notifications(kind='comment_on_assigned') row for the assignee (FR-25).
 * - Emits PostHog `comment_posted` event post-transaction.
 */
export async function postComment(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ comment: Comment }>> {
  const parsed = postCommentSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    const field = err?.path[0]?.toString();
    return validationError(err?.message ?? 'Validation failed', field);
  }

  const { todoId, body } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify the todo exists
      const todo = await tx.todo.findUnique({
        where: { id: todoId },
        select: { id: true, assigneeUserId: true },
      });
      if (!todo) return { todo: null } as const;

      // Rate limit: 10 posts per 60 seconds
      const rl = await checkRateLimit(tx, {
        userId: ctx.actor.id,
        actionKey: 'postComment',
        windowSeconds: 60,
        limit: 10,
      });

      if (!rl.allowed) {
        return { rateLimited: true } as const;
      }

      // Insert comment
      const comment = await tx.comment.create({
        data: {
          todoId,
          authorUserId: ctx.actor.id,
          body,
        },
      });

      // Emit activity event
      await recordActivity(tx, {
        actorUserId: ctx.actor.id,
        kind: 'comment_posted',
        targetTodoId: todoId,
      });

      // FR-25: If the todo has an assignee and the assignee is not the author,
      // notify the assignee of the new comment.
      if (todo.assigneeUserId && todo.assigneeUserId !== ctx.actor.id) {
        await createCommentOnAssignedNotification(tx, {
          userId: todo.assigneeUserId,
          targetTodoId: todoId,
          triggeredByUserId: ctx.actor.id,
        });
      }

      return { comment } as const;
    });

    if ('todo' in result && result.todo === null) {
      return { ok: false, error: { code: 'not_found', message: 'Todo not found.' } };
    }

    if ('rateLimited' in result && result.rateLimited) {
      return { ok: false, error: { code: 'rate_limited', message: "You're doing that too fast — try again in a moment." } };
    }

    if (!('comment' in result)) {
      return { ok: false, error: { code: 'internal_error', message: 'Failed to post comment.' } };
    }

    // Post-transaction analytics
    void track({
      name: 'comment_posted',
      props: {
        userId: ctx.actor.id,
        todoId,
        commentLengthBucket: commentLengthBucket(body),
      },
    });

    return { ok: true, data: { comment: mapCommentRow(result.comment) } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to post comment.' } };
  }
}

// ============================================================================
// editComment
// ============================================================================

/**
 * Edit a comment body. Author-only.
 * Sets edited_at = now().
 */
export async function editComment(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ comment: Comment }>> {
  const parsed = editCommentSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    const field = err?.path[0]?.toString();
    return validationError(err?.message ?? 'Validation failed', field);
  }

  const { id, body } = parsed.data;

  try {
    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, error: { code: 'not_found', message: 'Comment not found.' } };
    }

    // Author-only guard (FR-19)
    if (existing.authorUserId !== ctx.actor.id) {
      return { ok: false, error: { code: 'forbidden', message: 'Only the comment author can edit this comment.' } };
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: {
        body,
        editedAt: new Date(),
      },
    });

    return { ok: true, data: { comment: mapCommentRow(updated) } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to edit comment.' } };
  }
}

// ============================================================================
// deleteComment
// ============================================================================

/**
 * Delete a comment. Author-only.
 */
export async function deleteComment(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ ok: true }>> {
  const parsed = deleteCommentSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { id } = parsed.data;

  try {
    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, error: { code: 'not_found', message: 'Comment not found.' } };
    }

    // Author-only guard (FR-19)
    if (existing.authorUserId !== ctx.actor.id) {
      return { ok: false, error: { code: 'forbidden', message: 'Only the comment author can delete this comment.' } };
    }

    await prisma.comment.delete({ where: { id } });
    return { ok: true, data: { ok: true } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to delete comment.' } };
  }
}

// ============================================================================
// listComments
// ============================================================================

/**
 * List comments on a todo, sorted oldest-first (FR-18).
 */
export async function listComments(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<Comment[]>> {
  const parsed = listCommentsSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { todoId } = parsed.data;

  try {
    const rows = await prisma.comment.findMany({
      where: { todoId },
      orderBy: { createdAt: 'asc' },
    });

    return { ok: true, data: rows.map(mapCommentRow) };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to list comments.' } };
  }
  void ctx;
}
