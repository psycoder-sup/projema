/**
 * Integration tests for Phase 4: Activity feed (FR-20 Team Activity slice).
 * listActivity returns newest first, respects limit, includes all qualifying events
 * from createTodo/updateTodo status change/postComment/sprint actions.
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
// FR-20: Team Activity slice — listActivity
// ============================================================================

describe('FR-20 Team Activity: listActivity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('returns events newest-first', async () => {
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();

    // Seed 5 events with ascending timestamps (spaced by 1ms for deterministic order)
    for (let i = 0; i < 5; i++) {
      await seedActivity({
        actorUserId: actor.id,
        kind: 'todo_created',
        createdAt: new Date(Date.now() + i),
      });
    }

    const res = await listActivity({}, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const events = res.data.data;
      expect(events.length).toBeGreaterThanOrEqual(5);
      // Verify descending order (newest first)
      for (let i = 1; i < events.length; i++) {
        expect(events[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
          events[i]!.createdAt.getTime(),
        );
      }
    }
  });

  test('default limit is 15 when 20 events exist', async () => {
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();

    // Seed 20 events
    for (let i = 0; i < 20; i++) {
      await seedActivity({
        actorUserId: actor.id,
        kind: 'todo_created',
        createdAt: new Date(Date.now() + i),
      });
    }

    const res = await listActivity({}, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.data).toHaveLength(15);
    }
  });

  test('custom limit is respected', async () => {
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();

    for (let i = 0; i < 10; i++) {
      await seedActivity({
        actorUserId: actor.id,
        kind: 'todo_created',
        createdAt: new Date(Date.now() + i),
      });
    }

    const res = await listActivity({ limit: 5 }, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.data).toHaveLength(5);
    }
  });

  test('before cursor paginates correctly', async () => {
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();

    // Seed 10 events with known timestamps
    const base = Date.now();
    for (let i = 0; i < 10; i++) {
      await seedActivity({
        actorUserId: actor.id,
        kind: 'todo_created',
        createdAt: new Date(base + i),
      });
    }

    // Get first page (5 newest)
    const page1 = await listActivity({ limit: 5 }, { actor });
    expect(page1.ok).toBe(true);
    if (!page1.ok) return;

    const oldestOnPage1 = page1.data.data[page1.data.data.length - 1];
    expect(oldestOnPage1).toBeDefined();

    // Get next page using before cursor
    const page2 = await listActivity(
      { limit: 5, before: oldestOnPage1!.createdAt.toISOString() },
      { actor },
    );
    expect(page2.ok).toBe(true);
    if (page2.ok) {
      // All events on page 2 should be older than the oldest on page 1
      for (const ev of page2.data.data) {
        expect(ev.createdAt.getTime()).toBeLessThan(oldestOnPage1!.createdAt.getTime());
      }
    }
  });

  test('empty list when no events exist', async () => {
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();
    const res = await listActivity({}, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.data).toHaveLength(0);
  });

  test('createTodo produces todo_created event visible in listActivity', async () => {
    const { createTodo } = await import('@/server/actions/todos');
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();

    const createRes = await createTodo({ title: 'Activity todo' }, { actor });
    expect(createRes.ok).toBe(true);

    const actRes = await listActivity({}, { actor });
    expect(actRes.ok).toBe(true);
    if (actRes.ok) {
      const kinds = actRes.data.data.map((e) => e.kind);
      expect(kinds).toContain('todo_created');
    }
  });

  test('updateTodo status change produces todo_status_changed event', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();
    const todo = await seedTodo({ status: 'todo' });

    await updateTodo({ id: todo.id, status: 'done' }, { actor });

    const actRes = await listActivity({}, { actor });
    expect(actRes.ok).toBe(true);
    if (actRes.ok) {
      const statusEvent = actRes.data.data.find((e) => e.kind === 'todo_status_changed');
      expect(statusEvent).toBeDefined();
      expect(statusEvent?.payload).toMatchObject({ from: 'todo', to: 'done' });
    }
  });

  test('postComment produces comment_posted event', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();
    const todo = await seedTodo();

    await postComment({ todoId: todo.id, body: 'activity check' }, { actor });

    const actRes = await listActivity({}, { actor });
    expect(actRes.ok).toBe(true);
    if (actRes.ok) {
      const kinds = actRes.data.data.map((e) => e.kind);
      expect(kinds).toContain('comment_posted');
    }
  });

  test('sprint actions produce sprint_created, sprint_activated, sprint_completed events', async () => {
    const { createSprint, activateSprint, completeSprint } = await import('@/server/actions/sprints');
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();

    const sprintRes = await createSprint(
      {
        name: 'Activity Sprint',
        startDate: '2026-04-20',
        endDate: '2026-05-04',
        goals: [],
      },
      { actor },
    );
    expect(sprintRes.ok).toBe(true);
    if (!sprintRes.ok) return;

    const activateRes = await activateSprint({ id: sprintRes.data.sprint.id }, { actor });
    expect(activateRes.ok).toBe(true);

    const completeRes = await completeSprint({ id: sprintRes.data.sprint.id }, { actor });
    expect(completeRes.ok).toBe(true);

    const actRes = await listActivity({ limit: 50 }, { actor });
    expect(actRes.ok).toBe(true);
    if (actRes.ok) {
      const kinds = actRes.data.data.map((e) => e.kind);
      expect(kinds).toContain('sprint_created');
      expect(kinds).toContain('sprint_activated');
      expect(kinds).toContain('sprint_completed');
    }
  });

  test('activity event has correct targetTodoId for comment_posted', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();
    const todo = await seedTodo();

    await postComment({ todoId: todo.id, body: 'check target' }, { actor });

    const actRes = await listActivity({}, { actor });
    expect(actRes.ok).toBe(true);
    if (actRes.ok) {
      const commentEvent = actRes.data.data.find((e) => e.kind === 'comment_posted');
      expect(commentEvent?.targetTodoId).toBe(todo.id);
    }
  });
});

// ============================================================================
// seedActivity fixture ordering test
// ============================================================================

describe('seedActivity fixture', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('seedActivity with explicit createdAt timestamps maintains insertion and queryable order', async () => {
    const { listActivity } = await import('@/server/actions/activity');
    const actor = await createMember();

    const now = Date.now();
    const events = [
      await seedActivity({ actorUserId: actor.id, kind: 'todo_created', createdAt: new Date(now + 1) }),
      await seedActivity({ actorUserId: actor.id, kind: 'todo_created', createdAt: new Date(now + 2) }),
      await seedActivity({ actorUserId: actor.id, kind: 'todo_created', createdAt: new Date(now + 3) }),
    ];

    const res = await listActivity({}, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Newest first
      const ids = res.data.data.map((e) => e.id);
      expect(ids[0]).toBe(events[2]!.id);
      expect(ids[1]).toBe(events[1]!.id);
      expect(ids[2]).toBe(events[0]!.id);
    }
  });
});
