/**
 * Integration tests for Phase 5: getDashboardData (FR-20).
 * Tests all four dashboard sections against a real Postgres database (Testcontainers).
 *
 * SPEC §13.5 FR-20 skeletons.
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
  seedActivity,
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
// FR-20: getDashboardData — all four sections
// ============================================================================

describe('FR-20: getDashboardData — activeSprint goal aggregates', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('returns correct goalProgress for active sprint with 2 goals and varied todo statuses', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    // Active sprint with goals G1 and G2
    const s = await seedSprint({ status: 'active', withGoals: ['G1', 'G2'] });
    const g1 = s.goals[0]!;
    const g2 = s.goals[1]!;

    // G1: 1 done + 1 todo = 1/2
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id, status: 'done' });
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id, status: 'todo' });

    // G2: 0 done + 1 in_progress = 0/1
    await seedTodo({ sprintId: s.id, sprintGoalId: g2.id, status: 'in_progress' });

    const data = await getDashboardData({ actor: user });

    expect(data.activeSprint).not.toBeNull();
    const { goalProgress, overall } = data.activeSprint!;

    const g1Progress = goalProgress.find((g) => g.name === 'G1');
    expect(g1Progress).toBeDefined();
    expect(g1Progress!.done).toBe(1);
    expect(g1Progress!.total).toBe(2);
    expect(g1Progress!.goalId).toBe(g1.id);

    const g2Progress = goalProgress.find((g) => g.name === 'G2');
    expect(g2Progress).toBeDefined();
    expect(g2Progress!.done).toBe(0);
    expect(g2Progress!.total).toBe(1);

    // Overall: 1 done out of 3 total
    expect(overall).toEqual({ done: 1, total: 3 });
  });

  test('includes "Unassigned to goal" row when sprint has todos with no goal', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    const s = await seedSprint({ status: 'active', withGoals: ['G1'] });
    const g1 = s.goals[0]!;

    // One todo in G1
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id, status: 'todo' });

    // Two todos with no goal
    await seedTodo({ sprintId: s.id, sprintGoalId: null, status: 'done' });
    await seedTodo({ sprintId: s.id, sprintGoalId: null, status: 'todo' });

    const data = await getDashboardData({ actor: user });

    expect(data.activeSprint).not.toBeNull();
    const { goalProgress } = data.activeSprint!;

    const unassigned = goalProgress.find((g) => g.goalId === null);
    expect(unassigned).toBeDefined();
    expect(unassigned!.name).toBe('Unassigned to goal');
    expect(unassigned!.done).toBe(1);
    expect(unassigned!.total).toBe(2);
  });

  test('does NOT include "Unassigned to goal" row when all todos have a goal', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    const s = await seedSprint({ status: 'active', withGoals: ['G1'] });
    const g1 = s.goals[0]!;
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id, status: 'todo' });

    const data = await getDashboardData({ actor: user });

    expect(data.activeSprint).not.toBeNull();
    const unassigned = data.activeSprint!.goalProgress.find((g) => g.goalId === null);
    expect(unassigned).toBeUndefined();
  });

  test('activeSprint is null when no sprint is active', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    // Planned and completed sprints, but no active one
    await seedSprint({ status: 'planned' });
    await seedSprint({ status: 'completed' });

    const data = await getDashboardData({ actor: user });

    expect(data.activeSprint).toBeNull();
  });

  test('activeSprint returns sprint with empty goalProgress when no todos exist', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    const s = await seedSprint({ status: 'active', withGoals: ['G1', 'G2'] });

    const data = await getDashboardData({ actor: user });

    expect(data.activeSprint).not.toBeNull();
    expect(data.activeSprint!.sprint.id).toBe(s.id);
    // Goals with no todos have 0/0 counts
    const g1 = data.activeSprint!.goalProgress.find((g) => g.name === 'G1');
    expect(g1).toBeDefined();
    expect(g1!.done).toBe(0);
    expect(g1!.total).toBe(0);
    expect(data.activeSprint!.overall).toEqual({ done: 0, total: 0 });
  });
});

// ============================================================================
// FR-20: myTodos
// ============================================================================

describe('FR-20: getDashboardData — myTodos', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('myTodos is capped at 10 (cap enforcement)', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    // Create 12 non-done todos assigned to user
    for (let i = 0; i < 12; i++) {
      await seedTodo({ assigneeUserId: user.id, status: 'todo' });
    }

    const data = await getDashboardData({ actor: user });
    expect(data.myTodos).toHaveLength(10);
  });

  test('myTodos: dueDate ASC NULLS LAST ordering — null comes after dated todos', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    // 9 todos with ascending due dates + 3 with null dueDate = 12 total
    // After cap-10: 9 dated + 1 null
    for (let i = 0; i < 9; i++) {
      await seedTodo({
        assigneeUserId: user.id,
        dueDate: `2026-05-${String(i + 1).padStart(2, '0')}`,
        status: 'todo',
      });
    }
    for (let i = 0; i < 3; i++) {
      await seedTodo({ assigneeUserId: user.id, dueDate: null, status: 'todo' });
    }

    const data = await getDashboardData({ actor: user });

    expect(data.myTodos).toHaveLength(10);
    // First 9 should be dated in ascending order
    expect(data.myTodos[0]!.dueDate).toBe('2026-05-01');
    expect(data.myTodos[8]!.dueDate).toBe('2026-05-09');
    // Last one should have null dueDate (NULLS LAST)
    expect(data.myTodos[9]!.dueDate).toBeNull();
  });

  test('myTodos excludes done todos', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    await seedTodo({ assigneeUserId: user.id, status: 'done' });
    await seedTodo({ assigneeUserId: user.id, status: 'todo' });
    await seedTodo({ assigneeUserId: user.id, status: 'in_progress' });

    const data = await getDashboardData({ actor: user });
    expect(data.myTodos).toHaveLength(2);
    expect(data.myTodos.every((t) => t.status !== 'done')).toBe(true);
  });

  test('myTodos only returns todos assigned to the current actor', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();
    const other = await createMember();

    await seedTodo({ assigneeUserId: user.id, status: 'todo' });
    await seedTodo({ assigneeUserId: other.id, status: 'todo' });
    await seedTodo({ assigneeUserId: null, status: 'todo' });

    const data = await getDashboardData({ actor: user });
    expect(data.myTodos).toHaveLength(1);
    expect(data.myTodos[0]!.assigneeUserId).toBe(user.id);
  });
});

// ============================================================================
// FR-20: upcomingDeadlines
// ============================================================================

describe('FR-20: getDashboardData — upcomingDeadlines', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('excludes todos with status=done', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    const today = new Date();
    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().substring(0, 10);

    await seedTodo({ dueDate: in3DaysStr, status: 'done' });
    await seedTodo({ dueDate: in3DaysStr, status: 'in_progress' });

    const data = await getDashboardData({ actor: user });

    expect(data.upcomingDeadlines).toHaveLength(1);
    expect(data.upcomingDeadlines[0]!.status).toBe('in_progress');
  });

  test('excludes todos with dueDate > 7 days out', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    const today = new Date();
    const in10Days = new Date(today);
    in10Days.setDate(today.getDate() + 10);
    const in10DaysStr = in10Days.toISOString().substring(0, 10);

    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().substring(0, 10);

    await seedTodo({ dueDate: in10DaysStr, status: 'in_progress' });
    await seedTodo({ dueDate: in3DaysStr, status: 'in_progress' });

    const data = await getDashboardData({ actor: user });
    expect(data.upcomingDeadlines).toHaveLength(1);
  });

  test('excludes todos with null dueDate', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    await seedTodo({ dueDate: null, status: 'todo' });

    const data = await getDashboardData({ actor: user });
    expect(data.upcomingDeadlines).toHaveLength(0);
  });

  test('upcoming deadlines include todos from any assignee', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();
    const other = await createMember();

    const today = new Date();
    const in2Days = new Date(today);
    in2Days.setDate(today.getDate() + 2);
    const in2DaysStr = in2Days.toISOString().substring(0, 10);

    await seedTodo({ dueDate: in2DaysStr, assigneeUserId: user.id, status: 'todo' });
    await seedTodo({ dueDate: in2DaysStr, assigneeUserId: other.id, status: 'todo' });
    await seedTodo({ dueDate: in2DaysStr, assigneeUserId: null, status: 'todo' });

    const data = await getDashboardData({ actor: user });
    expect(data.upcomingDeadlines).toHaveLength(3);
  });

  test('is capped at 15', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    const today = new Date();
    for (let i = 0; i < 20; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + 1);
      await seedTodo({ dueDate: d.toISOString().substring(0, 10), status: 'todo' });
    }

    const data = await getDashboardData({ actor: user });
    expect(data.upcomingDeadlines).toHaveLength(15);
  });
});

// ============================================================================
// FR-20: activity
// ============================================================================

describe('FR-20: getDashboardData — activity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('returns last 15 activity events newest-first', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    // Seed 20 events with 1ms spacing for deterministic order
    for (let i = 0; i < 20; i++) {
      await seedActivity({
        actorUserId: user.id,
        kind: 'todo_created',
        createdAt: new Date(Date.now() + i),
      });
    }

    const data = await getDashboardData({ actor: user });

    expect(data.activity).toHaveLength(15);
    // Newest first
    for (let i = 1; i < data.activity.length; i++) {
      expect(data.activity[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
        data.activity[i]!.createdAt.getTime(),
      );
    }
  });

  test('returns empty activity when no events exist', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    const data = await getDashboardData({ actor: user });
    expect(data.activity).toHaveLength(0);
  });
});

// ============================================================================
// FR-20: full integration — all four sections simultaneously
// ============================================================================

describe('FR-20: getDashboardData — full parallel integration', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('all four sections return correct data in a single call', async () => {
    const { getDashboardData } = await import('@/server/db/dashboard');
    const user = await createMember();

    // Active sprint with 3 goals
    const s = await seedSprint({ status: 'active', withGoals: ['G1', 'G2', 'G3'] });
    const [g1, g2] = [s.goals[0]!, s.goals[1]!];

    // G1: 2 done, 1 todo
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id, status: 'done' });
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id, status: 'done' });
    await seedTodo({ sprintId: s.id, sprintGoalId: g1.id, status: 'todo' });

    // G2: 0 done, 1 in_progress
    await seedTodo({ sprintId: s.id, sprintGoalId: g2.id, status: 'in_progress' });

    // myTodos: 2 assigned to user
    const today = new Date();
    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);

    await seedTodo({ assigneeUserId: user.id, dueDate: null, status: 'todo' });
    await seedTodo({
      assigneeUserId: user.id,
      dueDate: in3Days.toISOString().substring(0, 10),
      status: 'in_progress',
    });

    // upcoming deadlines: 1 (the in3Days one above counts; the null-dueDate one doesn't)

    // Activity events
    await seedActivity({ actorUserId: user.id, kind: 'sprint_created' });
    await seedActivity({ actorUserId: user.id, kind: 'todo_created' });

    const data = await getDashboardData({ actor: user });

    // activeSprint
    expect(data.activeSprint).not.toBeNull();
    expect(data.activeSprint!.sprint.id).toBe(s.id);
    const g1p = data.activeSprint!.goalProgress.find((g) => g.name === 'G1')!;
    expect(g1p.done).toBe(2);
    expect(g1p.total).toBe(3);
    expect(data.activeSprint!.overall.done).toBe(2);
    expect(data.activeSprint!.overall.total).toBe(4);

    // myTodos: 2 assigned todos (non-done), dueDate one should appear first (NULLS LAST)
    expect(data.myTodos).toHaveLength(2);
    expect(data.myTodos[0]!.dueDate).toBe(in3Days.toISOString().substring(0, 10));
    expect(data.myTodos[1]!.dueDate).toBeNull();

    // upcomingDeadlines: the in3Days todo (assigned to user, in_progress)
    expect(data.upcomingDeadlines.length).toBeGreaterThanOrEqual(1);

    // activity
    expect(data.activity.length).toBeGreaterThanOrEqual(2);
  });
});
