'use server';
/**
 * Sprint server actions — Phase 2.
 * All accept (input, ctx: { actor: User }) and return Result<T, ServerActionError>.
 * All mutations write activity events in the same transaction.
 */
import { prisma } from '@/server/db/client';
import { mapSprintRow, mapSprintGoalRow } from '@/server/db/sprint-mappers';
import { recordActivity } from '@/server/services/activity';
import type { Sprint, SprintGoal, Todo, TodoStatus, TodoPriority, Result, ServerActionError, User } from '@/types/domain';
import { toIsoDate } from '@/lib/utils/date';
import {
  createSprintSchema,
  updateSprintSchema,
  activateSprintSchema,
  completeSprintSchema,
  deleteSprintSchema,
  deleteSprintGoalSchema,
  listSprintsInputSchema,
  getSprintDetailSchema,
} from '@/lib/zod/sprints';

type ActionCtx = { actor: User };

// ============================================================================
// Helpers
// ============================================================================

function isUniqueConstraintError(err: unknown, indexName?: string): boolean {
  if (
    typeof err !== 'object' ||
    err === null ||
    !('code' in err) ||
    (err as { code: string }).code !== 'P2002'
  ) {
    return false;
  }
  if (indexName) {
    // Prisma error meta.target may include constraint/index name
    const meta = (err as { meta?: { target?: string | string[] } }).meta;
    if (meta?.target) {
      const targets = Array.isArray(meta.target) ? meta.target : [meta.target];
      return targets.some((t) => t.includes(indexName));
    }
  }
  return true;
}

function validationError(message: string, field?: string): Result<never, ServerActionError> {
  const base = { code: 'validation_failed' as const, message };
  return { ok: false, error: field !== undefined ? { ...base, field } : base };
}

// ============================================================================
// createSprint
// ============================================================================

export async function createSprint(
  input: {
    name: string;
    startDate: string;
    endDate: string;
    goals?: string[];
  },
  ctx: ActionCtx,
): Promise<Result<{ sprint: Sprint; goals: SprintGoal[] }>> {
  const parsed = createSprintSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    const field = err?.path[0]?.toString();
    return validationError(err?.message ?? 'Validation failed', field);
  }

  const { name, startDate, endDate, goals: goalNames } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: 'planned',
          createdByUserId: ctx.actor.id,
        },
      });

      const goals = [];
      for (let i = 0; i < goalNames.length; i++) {
        const goalName = goalNames[i];
        if (!goalName) continue;
        const goal = await tx.sprintGoal.create({
          data: {
            sprintId: sprint.id,
            name: goalName,
            position: i,
          },
        });
        goals.push(goal);
      }

      await recordActivity(tx, {
        actorUserId: ctx.actor.id,
        kind: 'sprint_created',
        targetSprintId: sprint.id,
      });

      return { sprint, goals };
    });

    return {
      ok: true,
      data: {
        sprint: mapSprintRow(result.sprint, result.goals),
        goals: result.goals.map(mapSprintGoalRow),
      },
    };
  } catch (err) {
    if (isUniqueConstraintError(err, 'sprint_goals_sprint_name_idx')) {
      return validationError('Goal names must be unique (case-insensitive)', 'goals');
    }
    return { ok: false, error: { code: 'internal_error', message: 'Failed to create sprint.' } };
  }
}

// ============================================================================
// updateSprint
// ============================================================================

export async function updateSprint(
  input: {
    id: string;
    name?: string;
    startDate?: string;
    endDate?: string;
    goalsUpsert?: Array<{ id?: string; name: string }>;
  },
  _ctx: ActionCtx,
): Promise<Result<{ sprint: Sprint; goals: SprintGoal[] }>> {
  const parsed = updateSprintSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.errors[0];
    const field = err?.path[0]?.toString();
    return validationError(err?.message ?? 'Validation failed', field);
  }

  const { id, name, startDate, endDate, goalsUpsert } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.sprint.findUnique({ where: { id } });
      if (!existing) return null;

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);

      const sprint = await tx.sprint.update({
        where: { id },
        data: updateData,
      });

      // Upsert goals if provided
      let goals;
      if (goalsUpsert !== undefined) {
        for (const g of goalsUpsert) {
          if (g.id) {
            await tx.sprintGoal.update({
              where: { id: g.id },
              data: { name: g.name },
            });
          } else {
            await tx.sprintGoal.create({
              data: {
                sprintId: id,
                name: g.name,
                position: 0,
              },
            });
          }
        }
        goals = await tx.sprintGoal.findMany({
          where: { sprintId: id },
          orderBy: { position: 'asc' },
        });
      } else {
        goals = await tx.sprintGoal.findMany({
          where: { sprintId: id },
          orderBy: { position: 'asc' },
        });
      }

      return { sprint, goals };
    });

    if (!result) {
      return { ok: false, error: { code: 'not_found', message: 'Sprint not found.' } };
    }

    return {
      ok: true,
      data: {
        sprint: mapSprintRow(result.sprint, result.goals),
        goals: result.goals.map(mapSprintGoalRow),
      },
    };
  } catch (err) {
    if (isUniqueConstraintError(err, 'sprint_goals_sprint_name_idx')) {
      return validationError('Goal names must be unique (case-insensitive)', 'goals');
    }
    return { ok: false, error: { code: 'internal_error', message: 'Failed to update sprint.' } };
  }
}

// ============================================================================
// deleteSprint
// ============================================================================

export async function deleteSprint(
  input: { id: string },
  ctx: ActionCtx,
): Promise<Result<{ deleted: boolean }>> {
  const parsed = deleteSprintSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { id } = parsed.data;

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id } });
    if (!sprint) {
      return { ok: false, error: { code: 'not_found', message: 'Sprint not found.' } };
    }

    if (sprint.status !== 'planned') {
      return {
        ok: false,
        error: {
          code: 'cannot_delete_sprint',
          message: 'Only planned sprints can be deleted.',
        },
      };
    }

    const todoCount = await prisma.todo.count({ where: { sprintId: id } });
    if (todoCount > 0) {
      return {
        ok: false,
        error: {
          code: 'cannot_delete_sprint',
          message: 'Cannot delete a sprint with attached todos.',
        },
      };
    }

    await prisma.sprint.delete({ where: { id } });
    return { ok: true, data: { deleted: true } };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to delete sprint.' } };
  }
  void ctx;
}

// ============================================================================
// deleteSprintGoal
// ============================================================================

export async function deleteSprintGoal(
  input: { goalId: string; strategy: 'detach_todos' | 'cancel' },
  ctx: ActionCtx,
): Promise<Result<{ deleted: boolean; detachedTodoCount?: number }>> {
  const parsed = deleteSprintGoalSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { goalId, strategy } = parsed.data;

  try {
    const goal = await prisma.sprintGoal.findUnique({ where: { id: goalId } });
    if (!goal) {
      return { ok: false, error: { code: 'not_found', message: 'Sprint goal not found.' } };
    }

    const attachedTodos = await prisma.todo.count({ where: { sprintGoalId: goalId } });

    if (attachedTodos > 0 && strategy === 'cancel') {
      return {
        ok: false,
        error: { code: 'conflict', message: 'Goal has attached todos. Use detach_todos strategy.' },
      };
    }

    await prisma.$transaction(async (tx) => {
      if (attachedTodos > 0 && strategy === 'detach_todos') {
        await tx.todo.updateMany({
          where: { sprintGoalId: goalId },
          data: { sprintGoalId: null },
        });
      }
      await tx.sprintGoal.delete({ where: { id: goalId } });
    });

    return {
      ok: true,
      data: {
        deleted: true,
        detachedTodoCount: strategy === 'detach_todos' ? attachedTodos : 0,
      },
    };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to delete sprint goal.' } };
  }
  void ctx;
}

// ============================================================================
// activateSprint
// ============================================================================

export async function activateSprint(
  input: { id: string; acknowledgedCompletingId?: string },
  ctx: ActionCtx,
): Promise<
  Result<{ sprint: Sprint; completedSprintId?: string }, ServerActionError>
> {
  const parsed = activateSprintSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { id, acknowledgedCompletingId } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Lock both the target sprint and any currently active sprint
        const [target, currentActive] = await Promise.all([
          tx.sprint.findUnique({ where: { id } }),
          tx.sprint.findFirst({ where: { status: 'active' } }),
        ]);

        if (!target) {
          return { error: { code: 'not_found' as const, message: 'Sprint not found.' } };
        }

        // If another sprint is already active (and it's not the target itself)
        if (currentActive && currentActive.id !== id) {
          // Require acknowledgement
          if (acknowledgedCompletingId !== currentActive.id) {
            return {
              error: {
                code: 'active_sprint_conflict' as const,
                message: 'Another sprint is active. Please acknowledge completing it first.',
                currentActiveSprintId: currentActive.id,
              },
            };
          }

          // Ack matches — complete the currently active sprint
          await tx.sprint.update({
            where: { id: currentActive.id },
            data: { status: 'completed', completedAt: new Date() },
          });

          await recordActivity(tx, {
            actorUserId: ctx.actor.id,
            kind: 'sprint_completed',
            targetSprintId: currentActive.id,
          });
        }

        // Activate the target sprint
        const updatedSprint = await tx.sprint.update({
          where: { id },
          data: { status: 'active' },
        });

        await recordActivity(tx, {
          actorUserId: ctx.actor.id,
          kind: 'sprint_activated',
          targetSprintId: id,
        });

        const goals = await tx.sprintGoal.findMany({
          where: { sprintId: id },
          orderBy: { position: 'asc' },
        });

        return {
          sprint: updatedSprint,
          goals,
          completedSprintId: currentActive && currentActive.id !== id ? currentActive.id : undefined,
        };
      },
      { isolationLevel: 'Serializable' },
    );

    if ('error' in result) {
      return { ok: false, error: result.error };
    }

    const data: { sprint: Sprint; completedSprintId?: string } = {
      sprint: mapSprintRow(result.sprint, result.goals),
    };
    if (result.completedSprintId !== undefined) {
      data.completedSprintId = result.completedSprintId;
    }
    return { ok: true, data };
  } catch (err) {
    // P2002 on sprints_one_active_idx means a concurrent activation won the race
    if (isUniqueConstraintError(err)) {
      // Re-read the now-winning active sprint
      const winningActive = await prisma.sprint.findFirst({ where: { status: 'active' } });
      if (winningActive) {
        return {
          ok: false,
          error: {
            code: 'active_sprint_conflict',
            message: 'Another sprint was activated concurrently. Please acknowledge completing it first.',
            currentActiveSprintId: winningActive.id,
          },
        };
      }
    }
    return { ok: false, error: { code: 'internal_error', message: 'Failed to activate sprint.' } };
  }
}

// ============================================================================
// completeSprint
// ============================================================================

export async function completeSprint(
  input: { id: string },
  ctx: ActionCtx,
): Promise<
  Result<{
    sprint: Sprint;
    totals: {
      todoTotal: number;
      todoDone: number;
      goalCount: number;
      fullyCompletedGoalCount: number;
    };
  }>
> {
  const parsed = completeSprintSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { id } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.findUnique({ where: { id } });
      if (!sprint) return null;

      const updatedSprint = await tx.sprint.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
      });

      const goals = await tx.sprintGoal.findMany({
        where: { sprintId: id },
        orderBy: { position: 'asc' },
      });

      const todos = await tx.todo.findMany({ where: { sprintId: id } });

      const todoTotal = todos.length;
      const todoDone = todos.filter((t) => t.status === 'done').length;
      const goalCount = goals.length;

      // A goal is "fully completed" if all todos attached to it are done
      const fullyCompletedGoalCount = goals.filter((g) => {
        const goalTodos = todos.filter((t) => t.sprintGoalId === g.id);
        return goalTodos.length > 0 && goalTodos.every((t) => t.status === 'done');
      }).length;

      await recordActivity(tx, {
        actorUserId: ctx.actor.id,
        kind: 'sprint_completed',
        targetSprintId: id,
        payload: { todoTotal, todoDone, goalCount, fullyCompletedGoalCount },
      });

      return {
        sprint: updatedSprint,
        goals,
        totals: { todoTotal, todoDone, goalCount, fullyCompletedGoalCount },
      };
    });

    if (!result) {
      return { ok: false, error: { code: 'not_found', message: 'Sprint not found.' } };
    }

    return {
      ok: true,
      data: {
        sprint: mapSprintRow(result.sprint, result.goals),
        totals: result.totals,
      },
    };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to complete sprint.' } };
  }
}

// ============================================================================
// listSprints
// ============================================================================

export async function listSprints(
  input: { status?: string },
  ctx: ActionCtx,
): Promise<Result<Sprint[]>> {
  const parsed = listSprintsInputSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  try {
    const where = parsed.data.status ? { status: parsed.data.status } : {};

    const rawSprints = await prisma.sprint.findMany({
      where,
      orderBy: [{ startDate: 'desc' }],
      include: {
        goals: {
          orderBy: { position: 'asc' },
        },
      },
    });

    const sprints = rawSprints.map((s) => mapSprintRow(s, s.goals));
    return { ok: true, data: sprints };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to list sprints.' } };
  }
  void ctx;
}

// ============================================================================
// getSprintDetail
// ============================================================================

type TodoDomain = Omit<Todo, 'links' | 'document'>;

export async function getSprintDetail(
  input: { id: string },
  ctx: ActionCtx,
): Promise<
  Result<{
    sprint: Sprint;
    todosGrouped: {
      byGoal: Record<string, TodoDomain[]>;
      unassignedToGoal: TodoDomain[];
    };
  }>
> {
  const parsed = getSprintDetailSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error.errors[0]?.message ?? 'Validation failed');
  }

  const { id } = parsed.data;

  try {
    const rawSprint = await prisma.sprint.findUnique({
      where: { id },
      include: {
        goals: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!rawSprint) {
      return { ok: false, error: { code: 'not_found', message: 'Sprint not found.' } };
    }

    const rawTodos = await prisma.todo.findMany({
      where: { sprintId: id },
      orderBy: { createdAt: 'asc' },
    });

    // Map todos to domain (lightweight projection)
    const domainTodos: TodoDomain[] = rawTodos.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status as TodoStatus,
      priority: t.priority as TodoPriority,
      assigneeUserId: t.assigneeUserId,
      dueDate: toIsoDate(t.dueDate),
      sprintId: t.sprintId,
      sprintGoalId: t.sprintGoalId,
      createdByUserId: t.createdByUserId,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    // Group todos by goal
    const byGoal: Record<string, TodoDomain[]> = {};
    const unassignedToGoal: TodoDomain[] = [];

    for (const todo of domainTodos) {
      if (todo.sprintGoalId) {
        const bucket = byGoal[todo.sprintGoalId] ?? [];
        bucket.push(todo);
        byGoal[todo.sprintGoalId] = bucket;
      } else {
        unassignedToGoal.push(todo);
      }
    }

    return {
      ok: true,
      data: {
        sprint: mapSprintRow(rawSprint, rawSprint.goals),
        todosGrouped: { byGoal, unassignedToGoal },
      },
    };
  } catch {
    return { ok: false, error: { code: 'internal_error', message: 'Failed to fetch sprint detail.' } };
  }
  void ctx;
}
