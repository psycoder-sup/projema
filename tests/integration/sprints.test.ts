/**
 * Integration tests for Phase 2: Sprints CRUD
 * FR-05..FR-10, FR-21, FR-22
 *
 * Runs against a real Postgres database (Testcontainers).
 */
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import {
  createMember,
  resetDb,
  resetDbClient,
  getDb,
  seedSprint,
  seedTodo,
  seedGoalWithTodos,
} from '../support/fixtures';
import { resetPrismaClient } from '@/server/db/client';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15').start();
  const connectionUri = container.getConnectionUri();

  process.env['DATABASE_URL'] = connectionUri;
  process.env['DIRECT_URL'] = connectionUri;

  resetDbClient();
  resetPrismaClient();

  execSync('pnpm prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: connectionUri,
      DIRECT_URL: connectionUri,
    },
    stdio: 'pipe',
    cwd: process.cwd(),
  });
}, 120_000);

afterAll(async () => {
  const db = getDb();
  await db.$disconnect();
  await container?.stop();
});

// ============================================================================
// FR-05: sprint validation
// ============================================================================

describe('FR-05: sprint validation', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('end date before start date is rejected', async () => {
    const { createSprint } = await import('@/server/actions/sprints');
    const result = await createSprint(
      { name: 'S1', startDate: '2026-05-10', endDate: '2026-05-01', goals: ['A'] },
      { actor: await createMember() },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation_failed');
      if (result.error.code === 'validation_failed') {
        expect(result.error.field).toBe('endDate');
      }
    }
  });

  test('duplicate goal names in one sprint are rejected', async () => {
    const { createSprint } = await import('@/server/actions/sprints');
    const result = await createSprint(
      { name: 'S2', startDate: '2026-05-01', endDate: '2026-05-14', goals: ['A', 'a'] },
      { actor: await createMember() },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation_failed');
  });

  test('name over 140 chars is rejected', async () => {
    const { createSprint } = await import('@/server/actions/sprints');
    const result = await createSprint(
      {
        name: 'x'.repeat(141),
        startDate: '2026-05-01',
        endDate: '2026-05-14',
        goals: [],
      },
      { actor: await createMember() },
    );
    expect(result.ok).toBe(false);
  });

  test('valid sprint with goals is created', async () => {
    const { createSprint } = await import('@/server/actions/sprints');
    const actor = await createMember();
    const result = await createSprint(
      {
        name: 'Valid Sprint',
        startDate: '2026-05-01',
        endDate: '2026-05-14',
        goals: ['Goal A', 'Goal B'],
      },
      { actor },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sprint.name).toBe('Valid Sprint');
      expect(result.data.goals).toHaveLength(2);
    }
  });
});

// ============================================================================
// FR-06: sprint status enum
// ============================================================================

describe('FR-06: sprint status enum', () => {
  test('Zod schema accepts only planned/active/completed', async () => {
    const { sprintStatusSchema } = await import('@/lib/zod/sprints');
    expect(sprintStatusSchema.safeParse('planned').success).toBe(true);
    expect(sprintStatusSchema.safeParse('active').success).toBe(true);
    expect(sprintStatusSchema.safeParse('completed').success).toBe(true);
    expect(sprintStatusSchema.safeParse('archived').success).toBe(false);
    expect(sprintStatusSchema.safeParse('').success).toBe(false);
  });
});

// ============================================================================
// FR-07: at most one active sprint
// ============================================================================

describe('FR-07: at most one active sprint', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('activating a second sprint without ack returns active_sprint_conflict', async () => {
    const { activateSprint } = await import('@/server/actions/sprints');
    const user = await createMember();
    const active = await seedSprint({ status: 'active' });
    const planned = await seedSprint({ status: 'planned' });

    const result = await activateSprint({ id: planned.id }, { actor: user });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('active_sprint_conflict');
    }
    void active; // used for setup
  });

  test('activating with correct ack flips previous to completed', async () => {
    const { activateSprint } = await import('@/server/actions/sprints');
    const db = getDb();
    const user = await createMember();
    const active = await seedSprint({ status: 'active' });
    const planned = await seedSprint({ status: 'planned' });

    const result = await activateSprint(
      { id: planned.id, acknowledgedCompletingId: active.id },
      { actor: user },
    );
    expect(result.ok).toBe(true);
    const after = await db.sprint.findMany({ where: { id: { in: [active.id, planned.id] } } });
    const byId = Object.fromEntries(after.map((s) => [s.id, s]));
    expect(byId[active.id]?.status).toBe('completed');
    expect(byId[active.id]?.completedAt).toBeInstanceOf(Date);
    expect(byId[planned.id]?.status).toBe('active');
  });

  test('conflict response includes the current active sprint id for client re-ack', async () => {
    const { activateSprint } = await import('@/server/actions/sprints');
    const user = await createMember();
    const currentActive = await seedSprint({ status: 'active' });
    const planned = await seedSprint({ status: 'planned' });

    // caller ack'd an id that is not actually the current active sprint
    const staleCompleted = await seedSprint({ status: 'completed' });
    const result = await activateSprint(
      { id: planned.id, acknowledgedCompletingId: staleCompleted.id },
      { actor: user },
    );
    expect(result.ok).toBe(false);
    if (result.ok === false && result.error.code === 'active_sprint_conflict') {
      expect(result.error.currentActiveSprintId).toBe(currentActive.id);
    } else {
      throw new Error('expected active_sprint_conflict error');
    }
    void planned;
  });

  test('DB-level partial unique index rejects a raw second active sprint insert', async () => {
    const db = getDb();
    await seedSprint({ status: 'active' });
    // bypass application guards and try the direct insert
    // Prisma wraps the Postgres error; match on the error code (23505 = unique violation)
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO sprints (id, name, start_date, end_date, status, created_by_user_id)
         VALUES (gen_random_uuid(), 'X', current_date, current_date, 'active', (SELECT id FROM users LIMIT 1))`,
      ),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof Error &&
        (err.message.includes('23505') ||
          err.message.toLowerCase().includes('unique') ||
          err.message.toLowerCase().includes('already exists')),
    );
  });

  test('no active sprint — can activate planned sprint without ack', async () => {
    const { activateSprint } = await import('@/server/actions/sprints');
    const user = await createMember();
    const planned = await seedSprint({ status: 'planned' });

    const result = await activateSprint({ id: planned.id }, { actor: user });
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// FR-08: deleting a goal with attached todos prompts detach-or-cancel
// ============================================================================

describe('FR-08: deleting a goal with attached todos prompts detach-or-cancel', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('deleteSprintGoal with strategy=cancel returns error when todos attached', async () => {
    const { deleteSprintGoal } = await import('@/server/actions/sprints');
    const goal = await seedGoalWithTodos({ todoCount: 2 });
    const res = await deleteSprintGoal(
      { goalId: goal.id, strategy: 'cancel' },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(false);
  });

  test('deleteSprintGoal with strategy=detach_todos clears sprint_goal_id and deletes goal', async () => {
    const { deleteSprintGoal } = await import('@/server/actions/sprints');
    const db = getDb();
    const goal = await seedGoalWithTodos({ todoCount: 2 });
    const res = await deleteSprintGoal(
      { goalId: goal.id, strategy: 'detach_todos' },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const todos = await db.todo.findMany({ where: { sprintGoalId: goal.id } });
    expect(todos).toHaveLength(0);
  });

  test('deleteSprintGoal with strategy=cancel and no todos succeeds', async () => {
    const { deleteSprintGoal } = await import('@/server/actions/sprints');
    const sprint = await seedSprint({ withGoals: ['EmptyGoal'] });
    const goal = sprint.goals[0];
    if (!goal) throw new Error('Goal not created');
    const res = await deleteSprintGoal(
      { goalId: goal.id, strategy: 'cancel' },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
  });
});

// ============================================================================
// FR-09: delete only planned sprints with no todos
// ============================================================================

describe('FR-09: delete only planned sprints with no todos', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('cannot delete active sprint', async () => {
    const { deleteSprint } = await import('@/server/actions/sprints');
    const s = await seedSprint({ status: 'active' });
    const res = await deleteSprint({ id: s.id }, { actor: await createMember() });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('cannot_delete_sprint');
  });

  test('cannot delete completed sprint', async () => {
    const { deleteSprint } = await import('@/server/actions/sprints');
    const s = await seedSprint({ status: 'completed' });
    const res = await deleteSprint({ id: s.id }, { actor: await createMember() });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('cannot_delete_sprint');
  });

  test('cannot delete planned sprint with attached todos', async () => {
    const { deleteSprint } = await import('@/server/actions/sprints');
    const s = await seedSprint({ status: 'planned' });
    await seedTodo({ sprintId: s.id });
    const res = await deleteSprint({ id: s.id }, { actor: await createMember() });
    expect(res.ok).toBe(false);
  });

  test('can delete planned sprint with no todos', async () => {
    const { deleteSprint } = await import('@/server/actions/sprints');
    const s = await seedSprint({ status: 'planned' });
    const res = await deleteSprint({ id: s.id }, { actor: await createMember() });
    expect(res.ok).toBe(true);
  });
});

// ============================================================================
// FR-10: completed sprint retains todo linkage
// ============================================================================

describe('FR-10: completed sprint retains todo linkage', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('after completeSprint, attached todos still have sprintId and goal', async () => {
    const { completeSprint } = await import('@/server/actions/sprints');
    const db = getDb();
    const s = await seedSprint({ status: 'active', withGoals: ['G1'] });
    const todo = await seedTodo({ sprintId: s.id, sprintGoalId: s.goals[0]?.id ?? null });

    await completeSprint({ id: s.id }, { actor: await createMember() });

    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.sprintId).toBe(s.id);
    expect(after?.sprintGoalId).toBe(s.goals[0]?.id);
  });

  test('completeSprint returns totals', async () => {
    const { completeSprint } = await import('@/server/actions/sprints');
    const s = await seedSprint({ status: 'active', withGoals: ['G1'] });
    await seedTodo({ sprintId: s.id, status: 'done' });
    await seedTodo({ sprintId: s.id, status: 'todo' });

    const result = await completeSprint({ id: s.id }, { actor: await createMember() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totals.todoTotal).toBe(2);
      expect(result.data.totals.todoDone).toBe(1);
    }
  });
});

// ============================================================================
// FR-21: sprints grouped by status, sorted by start_date desc
// ============================================================================

describe('FR-21: sprints grouped by status, sorted by start_date desc', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('listSprints returns sprints sorted by start_date DESC within status', async () => {
    const { listSprints } = await import('@/server/actions/sprints');
    await seedSprint({ status: 'planned', startDate: '2026-05-01' });
    await seedSprint({ status: 'planned', startDate: '2026-04-01' });
    const result = await listSprints({}, { actor: await createMember() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const planned = result.data.filter((s) => s.status === 'planned');
      expect(planned.map((s) => s.startDate)).toEqual(['2026-05-01', '2026-04-01']);
    }
  });

  test('listSprints can filter by status', async () => {
    const { listSprints } = await import('@/server/actions/sprints');
    await seedSprint({ status: 'planned' });
    await seedSprint({ status: 'active' });
    const result = await listSprints({ status: 'planned' }, { actor: await createMember() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.every((s) => s.status === 'planned')).toBe(true);
    }
  });
});

// ============================================================================
// FR-22: sprint detail groups by goal and surfaces "unassigned to goal"
// ============================================================================

describe('FR-22: sprint detail groups by goal and surfaces unassigned to goal', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('todos attached to sprint but no goal land in the unassigned group', async () => {
    const { getSprintDetail } = await import('@/server/actions/sprints');
    const s = await seedSprint({ withGoals: ['A'] });
    await seedTodo({ sprintId: s.id, sprintGoalId: s.goals[0]?.id ?? null });
    await seedTodo({ sprintId: s.id, sprintGoalId: null });
    const result = await getSprintDetail({ id: s.id }, { actor: await createMember() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.todosGrouped.unassignedToGoal).toHaveLength(1);
    }
  });

  test('todos attached to a goal are grouped under that goalId', async () => {
    const { getSprintDetail } = await import('@/server/actions/sprints');
    const s = await seedSprint({ withGoals: ['Goal1', 'Goal2'] });
    const g1 = s.goals[0];
    const g2 = s.goals[1];
    if (!g1 || !g2) throw new Error('Goals not created');
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id });
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id });
    await seedTodo({ sprintId: s.id, sprintGoalId: g2.id });

    const result = await getSprintDetail({ id: s.id }, { actor: await createMember() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.todosGrouped.byGoal[g1.id]).toHaveLength(2);
      expect(result.data.todosGrouped.byGoal[g2.id]).toHaveLength(1);
      expect(result.data.todosGrouped.unassignedToGoal).toHaveLength(0);
    }
  });

  test('sprint not found returns not_found error', async () => {
    const { getSprintDetail } = await import('@/server/actions/sprints');
    const result = await getSprintDetail(
      { id: '00000000-0000-0000-0000-000000000000' },
      { actor: await createMember() },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_found');
  });
});

// ============================================================================
// Additional: updateSprint
// ============================================================================

describe('updateSprint: edit sprint name and goals', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('can rename a planned sprint', async () => {
    const { updateSprint } = await import('@/server/actions/sprints');
    const s = await seedSprint({ status: 'planned' });
    const result = await updateSprint(
      { id: s.id, name: 'Renamed Sprint' },
      { actor: await createMember() },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sprint.name).toBe('Renamed Sprint');
    }
  });

  test('can rename an active sprint', async () => {
    const { updateSprint } = await import('@/server/actions/sprints');
    const s = await seedSprint({ status: 'active' });
    const result = await updateSprint(
      { id: s.id, name: 'Active Renamed' },
      { actor: await createMember() },
    );
    expect(result.ok).toBe(true);
  });

  test('createSprint emits sprint_created activity', async () => {
    const { createSprint } = await import('@/server/actions/sprints');
    const db = getDb();
    const actor = await createMember();
    const result = await createSprint(
      { name: 'Sprint With Activity', startDate: '2026-05-01', endDate: '2026-05-14', goals: [] },
      { actor },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const activity = await db.activityEvent.findFirst({
        where: { kind: 'sprint_created', targetSprintId: result.data.sprint.id },
      });
      expect(activity).not.toBeNull();
    }
  });
});

// ============================================================================
// DB constraint tests
// ============================================================================

describe('DB constraints', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('sprints CHECK: end_date >= start_date enforced at DB level', async () => {
    const db = getDb();
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO sprints (id, name, start_date, end_date, status, created_by_user_id)
         VALUES (gen_random_uuid(), 'Bad', '2026-05-10', '2026-05-01', 'planned', (SELECT id FROM users LIMIT 1))`,
      ),
    ).rejects.toThrow();
  });

  test('sprint_goals UNIQUE(sprint_id, lower(name)) enforced at DB level', async () => {
    const db = getDb();
    const sprint = await seedSprint({ withGoals: [] });
    await db.$executeRawUnsafe(
      `INSERT INTO sprint_goals (id, sprint_id, name, position, created_at)
       VALUES (gen_random_uuid(), '${sprint.id}', 'DupGoal', 0, now())`,
    );
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO sprint_goals (id, sprint_id, name, position, created_at)
         VALUES (gen_random_uuid(), '${sprint.id}', 'dupgoal', 0, now())`,
      ),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof Error &&
        (err.message.includes('23505') ||
          err.message.toLowerCase().includes('unique') ||
          err.message.toLowerCase().includes('already exists')),
    );
  });
});
