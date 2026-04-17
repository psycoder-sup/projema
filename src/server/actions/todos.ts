'use server';
/**
 * Todo server actions — Phase 3.
 * All accept (input, ctx: { actor: User }) and return Result<T, ServerActionError>.
 * All mutations run inside a single Prisma transaction that also writes activity_events.
 */
import { prisma } from '@/server/db/client';
import { mapTodoRow, mapTodoLinkRow, mapTodoDocumentRow } from '@/server/db/todo-mappers';
import { mapCommentRow } from '@/server/db/comment-mappers';
import { recordActivity } from '@/server/services/activity';
import { createAssignedNotification } from '@/server/services/notifications';
import type { Todo, TodoLink, TodoDocument, Comment, Result, ServerActionError, User } from '@/types/domain';
import {
  createTodoSchema,
  updateTodoSchema,
  deleteTodoSchema,
  listTodosInputSchema,
  getTodoDetailSchema,
  addTodoLinkSchema,
  removeTodoLinkSchema,
  saveTodoDocumentSchema,
  deleteTodoDocumentSchema,
} from '@/lib/zod/todos';

type ActionCtx = { actor: User };

// ============================================================================
// Helpers
// ============================================================================

function validationError(message: string, field?: string): Result<never, ServerActionError> {
  const base = { code: 'validation_failed' as const, message };
  return { ok: false, error: field !== undefined ? { ...base, field } : base };
}

const NULLABLE_FIELDS = ['assigneeUserId', 'dueDate', 'sprintId', 'sprintGoalId', 'description'] as const;

// ============================================================================
// createTodo
// ============================================================================

export async function createTodo(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ todo: Todo }>> {
  const parsed = createTodoSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    const field = err?.path[0]?.toString();
    return validationError(err?.message ?? 'Validation failed', field);
  }

  const { title, description, status, priority, assigneeUserId, dueDate, sprintId, sprintGoalId, links } = parsed.data;

  // Validate assignee if provided
  if (assigneeUserId) {
    const assignee = await prisma.user.findUnique({ where: { id: assigneeUserId } });
    if (!assignee || !assignee.isActive) {
      return validationError('Assignee must be an existing, active org member', 'assigneeUserId');
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const todo = await tx.todo.create({
        data: {
          title,
          description: description ?? null,
          status: status ?? 'todo',
          priority: priority ?? 'medium',
          assigneeUserId: assigneeUserId ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
          sprintId: sprintId ?? null,
          sprintGoalId: sprintGoalId ?? null,
          createdByUserId: ctx.actor.id,
        },
      });

      // Create initial links
      const createdLinks = [];
      if (links && links.length > 0) {
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          if (!link) continue;
          const created = await tx.todoLink.create({
            data: {
              todoId: todo.id,
              url: link.url,
              label: link.label ?? null,
              position: i,
            },
          });
          createdLinks.push(created);
        }
      }

      await recordActivity(tx, {
        actorUserId: ctx.actor.id,
        kind: 'todo_created',
        targetTodoId: todo.id,
      });

      // Emit todo_assigned if assignee is set and different from actor
      if (assigneeUserId && assigneeUserId !== ctx.actor.id) {
        await recordActivity(tx, {
          actorUserId: ctx.actor.id,
          kind: 'todo_assigned',
          targetTodoId: todo.id,
          payload: { assigneeUserId },
        });

        await createAssignedNotification(tx, {
          userId: assigneeUserId,
          targetTodoId: todo.id,
          triggeredByUserId: ctx.actor.id,
        });
      }

      return { todo, links: createdLinks };
    });

    return {
      ok: true,
      data: {
        todo: mapTodoRow(result.todo, result.links, null),
      },
    };
  } catch (err) {
    // DB trigger violation (goal not in sprint)
    if (err instanceof Error && err.message.includes('does not belong to sprint_id')) {
      return validationError('Sprint goal does not belong to the selected sprint', 'sprintGoalId');
    }
    return { ok: false, error: { code: 'internal_error', message: 'Failed to create todo.' } };
  }
}

// ============================================================================
// updateTodo
// NOTE: For nullable fields, we use Object.prototype.hasOwnProperty.call(rawInput, field)
// on the raw (pre-parsed) input to distinguish "key absent" from "key present with null".
// ============================================================================

export async function updateTodo(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ todo: Todo; stale?: boolean }>> {
  const parsed = updateTodoSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    const field = err?.path[0]?.toString();
    return validationError(err?.message ?? 'Validation failed', field);
  }

  const { id, expectedUpdatedAt, ...patch } = parsed.data;

  // Validate assignee if being set
  const rawAssignee = Object.prototype.hasOwnProperty.call(input, 'assigneeUserId')
    ? input['assigneeUserId']
    : undefined;
  if (rawAssignee !== undefined && rawAssignee !== null) {
    const assignee = await prisma.user.findUnique({ where: { id: rawAssignee as string } });
    if (!assignee || !assignee.isActive) {
      return validationError('Assignee must be an existing, active org member', 'assigneeUserId');
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.todo.findUnique({
        where: { id },
        include: { links: true, document: true },
      });
      if (!existing) return null;

      // Build update data using PATCH semantics
      const updateData: Record<string, unknown> = {};

      // Non-nullable fields — always PATCH if present
      if (patch.title !== undefined) updateData['title'] = patch.title;
      if (patch.status !== undefined) updateData['status'] = patch.status;
      if (patch.priority !== undefined) updateData['priority'] = patch.priority;

      // Nullable fields — key must be present in raw input to be applied
      for (const field of NULLABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(input, field)) {
          const rawValue = input[field];
          if (rawValue === null) {
            updateData[field] = null;
          } else if (rawValue !== undefined) {
            // Map snake_case raw to camelCase for Prisma
            if (field === 'dueDate' && typeof rawValue === 'string') {
              updateData['dueDate'] = new Date(rawValue);
            } else {
              updateData[field] = rawValue;
            }
          }
        }
      }

      // FR-16: if sprintId is being set to null, also clear sprintGoalId
      if (Object.prototype.hasOwnProperty.call(input, 'sprintId') && input['sprintId'] === null) {
        updateData['sprintGoalId'] = null;
      }

      // FR-15: status transitions set/clear completed_at
      if (patch.status !== undefined) {
        if (patch.status === 'done') {
          updateData['completedAt'] = new Date();
        } else {
          updateData['completedAt'] = null;
        }
      }

      const updated = await tx.todo.update({
        where: { id },
        data: updateData,
        include: { links: { orderBy: { position: 'asc' } }, document: true },
      });

      // Stale-edit: check if our expectedUpdatedAt is older than current
      let stale = false;
      if (expectedUpdatedAt) {
        const expected = new Date(expectedUpdatedAt);
        if (existing.updatedAt > expected) {
          stale = true;
        }
      }

      // Activity: emit status change
      if (patch.status !== undefined && patch.status !== existing.status) {
        await recordActivity(tx, {
          actorUserId: ctx.actor.id,
          kind: 'todo_status_changed',
          targetTodoId: id,
          payload: { from: existing.status, to: patch.status },
        });
      }

      // Activity: emit assignee change
      if (
        Object.prototype.hasOwnProperty.call(input, 'assigneeUserId') &&
        input['assigneeUserId'] !== existing.assigneeUserId
      ) {
        const newAssigneeId = input['assigneeUserId'] as string | null;
        if (newAssigneeId) {
          await recordActivity(tx, {
            actorUserId: ctx.actor.id,
            kind: 'todo_assigned',
            targetTodoId: id,
            payload: { assigneeUserId: newAssigneeId },
          });

          // FR-25: notify new assignee (only when assignee actually changed and is not the actor)
          if (newAssigneeId !== ctx.actor.id) {
            await createAssignedNotification(tx, {
              userId: newAssigneeId,
              targetTodoId: id,
              triggeredByUserId: ctx.actor.id,
            });
          }
        }
      }

      return { todo: updated, stale };
    });

    if (!result) {
      return { ok: false, error: { code: 'not_found', message: 'Todo not found.' } };
    }

    const data: { todo: Todo; stale?: boolean } = {
      todo: mapTodoRow(result.todo, result.todo.links, result.todo.document),
    };
    if (result.stale) {
      data.stale = true;
    }

    return { ok: true, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not belong to sprint_id')) {
      return validationError('Sprint goal does not belong to the selected sprint', 'sprintGoalId');
    }
    return { ok: false, error: { code: 'internal_error', message: 'Failed to update todo.' } };
  }
}

// ============================================================================
// deleteTodo
// ============================================================================

export async function deleteTodo(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ ok: true }>> {
  const parsed = deleteTodoSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { id } = parsed.data;

  try {
    const existing = await prisma.todo.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, error: { code: 'not_found', message: 'Todo not found.' } };
    }

    // Cascades to links, document via ON DELETE CASCADE
    await prisma.todo.delete({ where: { id } });
    return { ok: true, data: { ok: true } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to delete todo.' } };
  }
  void ctx;
}

// ============================================================================
// addTodoLink
// ============================================================================

export async function addTodoLink(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ link: TodoLink }>> {
  const parsed = addTodoLinkSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    const field = err?.path[0]?.toString();
    return validationError(err?.message ?? 'Validation failed', field);
  }

  const { todoId, url, label, position } = parsed.data;

  try {
    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) {
      return { ok: false, error: { code: 'not_found', message: 'Todo not found.' } };
    }

    // Determine position: if not supplied, append after existing links
    let resolvedPosition = position ?? 0;
    if (position === undefined) {
      const maxLink = await prisma.todoLink.findFirst({
        where: { todoId },
        orderBy: { position: 'desc' },
      });
      resolvedPosition = maxLink ? maxLink.position + 1 : 0;
    }

    const link = await prisma.todoLink.create({
      data: {
        todoId,
        url,
        label: label ?? null,
        position: resolvedPosition,
      },
    });

    return { ok: true, data: { link: mapTodoLinkRow(link) } };
  } catch (err) {
    // DB CHECK constraint violation on URL scheme
    if (err instanceof Error && err.message.includes('todo_links_url_scheme_check')) {
      return validationError('URL scheme must be http, https, or mailto', 'url');
    }
    return { ok: false, error: { code: 'internal_error', message: 'Failed to add link.' } };
  }
  void ctx;
}

// ============================================================================
// removeTodoLink
// ============================================================================

export async function removeTodoLink(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ ok: true }>> {
  const parsed = removeTodoLinkSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { linkId } = parsed.data;

  try {
    const link = await prisma.todoLink.findUnique({ where: { id: linkId } });
    if (!link) {
      return { ok: false, error: { code: 'not_found', message: 'Link not found.' } };
    }

    await prisma.todoLink.delete({ where: { id: linkId } });
    return { ok: true, data: { ok: true } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to remove link.' } };
  }
  void ctx;
}

// ============================================================================
// saveTodoDocument
// ============================================================================

export async function saveTodoDocument(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ doc: TodoDocument; stale?: boolean }>> {
  const parsed = saveTodoDocumentSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    // document_too_large refine returns message as the code
    if (err?.message === 'document_too_large') {
      return { ok: false, error: { code: 'document_too_large', message: 'Document exceeds 100KB limit.' } };
    }
    const field = err?.path[0]?.toString();
    return validationError(err?.message ?? 'Validation failed', field);
  }

  const { todoId, contentMarkdown, expectedUpdatedAt } = parsed.data;

  try {
    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) {
      return { ok: false, error: { code: 'not_found', message: 'Todo not found.' } };
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.todoDocument.findUnique({ where: { todoId } });

      // Stale-edit check
      let stale = false;
      if (expectedUpdatedAt && existing) {
        const expected = new Date(expectedUpdatedAt);
        if (existing.updatedAt > expected) {
          stale = true;
        }
      }

      // Upsert (last-write-wins — still writes even if stale)
      const doc = await tx.todoDocument.upsert({
        where: { todoId },
        create: {
          todoId,
          contentMarkdown,
          updatedByUserId: ctx.actor.id,
        },
        update: {
          contentMarkdown,
          updatedByUserId: ctx.actor.id,
        },
      });

      return { doc, stale };
    });

    const data: { doc: TodoDocument; stale?: boolean } = {
      doc: mapTodoDocumentRow(result.doc),
    };
    if (result.stale) {
      data.stale = true;
    }

    return { ok: true, data };
  } catch (err) {
    // DB CHECK constraint violation on size
    if (err instanceof Error && err.message.includes('todo_documents_size_check')) {
      return { ok: false, error: { code: 'document_too_large', message: 'Document exceeds 100KB limit.' } };
    }
    return { ok: false, error: { code: 'internal_error', message: 'Failed to save document.' } };
  }
}

// ============================================================================
// deleteTodoDocument
// ============================================================================

export async function deleteTodoDocument(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<{ ok: true }>> {
  const parsed = deleteTodoDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { todoId } = parsed.data;

  try {
    const doc = await prisma.todoDocument.findUnique({ where: { todoId } });
    if (!doc) {
      return { ok: false, error: { code: 'not_found', message: 'Document not found.' } };
    }

    await prisma.todoDocument.delete({ where: { todoId } });
    return { ok: true, data: { ok: true } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to delete document.' } };
  }
  void ctx;
}

// ============================================================================
// listTodos
// ============================================================================

export async function listTodos(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<Todo[]>> {
  const parsed = listTodosInputSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const filter = parsed.data.filter ?? {};

  try {
    const where: Record<string, unknown> = {};

    // assigneeUserId filter
    if (filter.assigneeUserId !== undefined) {
      where['assigneeUserId'] = filter.assigneeUserId;
    }

    // status filter
    if (filter.status !== undefined) {
      where['status'] = filter.status;
    }

    // priority filter
    if (filter.priority !== undefined) {
      where['priority'] = filter.priority;
    }

    // sprintScope filter
    const scope = filter.sprintScope;
    if (scope) {
      if (scope.kind === 'backlog') {
        where['sprintId'] = null;
      } else if (scope.kind === 'sprint') {
        where['sprintId'] = scope.sprintId;
      }
      // kind === 'any' means no sprintId filter
    }

    const rawTodos = await prisma.todo.findMany({
      where,
      include: {
        links: { orderBy: { position: 'asc' } },
        document: true,
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 200,
    });

    return {
      ok: true,
      data: rawTodos.map((t) => mapTodoRow(t, t.links, t.document)),
    };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to list todos.' } };
  }
  void ctx;
}

// ============================================================================
// getTodoDetail
// ============================================================================

type TodoDetailResult = Todo & {
  sprint: { id: string; name: string; status: string } | null;
  goal: { id: string; name: string } | null;
  assignee: { id: string; displayName: string; avatarUrl: string | null } | null;
  comments: Comment[];
};

export async function getTodoDetail(
  input: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Result<TodoDetailResult>> {
  const parsed = getTodoDetailSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { id } = parsed.data;

  try {
    const raw = await prisma.todo.findUnique({
      where: { id },
      include: {
        links: { orderBy: { position: 'asc' } },
        document: true,
        sprint: { select: { id: true, name: true, status: true } },
        sprintGoal: { select: { id: true, name: true } },
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!raw) {
      return { ok: false, error: { code: 'not_found', message: 'Todo not found.' } };
    }

    const todo = mapTodoRow(raw, raw.links, raw.document);

    return {
      ok: true,
      data: {
        ...todo,
        sprint: raw.sprint
          ? { id: raw.sprint.id, name: raw.sprint.name, status: raw.sprint.status }
          : null,
        goal: raw.sprintGoal
          ? { id: raw.sprintGoal.id, name: raw.sprintGoal.name }
          : null,
        assignee: raw.assignee
          ? {
              id: raw.assignee.id,
              displayName: raw.assignee.displayName,
              avatarUrl: raw.assignee.avatarUrl,
            }
          : null,
        comments: raw.comments.map(mapCommentRow),
      },
    };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to fetch todo.' } };
  }
  void ctx;
}
