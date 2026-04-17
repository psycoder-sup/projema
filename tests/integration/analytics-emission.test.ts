/**
 * Integration tests for Phase 7: PostHog event emission from server actions.
 *
 * Uses __setPosthogClientForTest to inject a mock sink.
 * Verifies:
 * - createTodo → exactly one todo_created event with correct hasSprint/hasGoal/hasAssignee.
 * - updateTodo status change → todo_status_changed with from/to.
 * - updateTodo assignee change → todo_assigned with assigneeUserId.
 * - postComment → comment_posted.
 * - Failed transactions (Zod validation error) → NO event emitted.
 * - todo_assigned emitted on createTodo when assignee != actor.
 */
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import {
  createAdmin,
  createMember,
  resetDb,
  resetDbClient,
  getDb,
  seedTodo,
  seedSprint,
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

// Helper: install mock sink + return captured array
async function withMockSink() {
  const { __setPosthogClientForTest } = await import('@/server/analytics/events');
  const captured: Array<{ distinctId: string; event: string; properties?: Record<string, unknown> }> = [];
  __setPosthogClientForTest({
    capture: (args) => { captured.push(args); },
  });
  return {
    captured,
    restore: () => __setPosthogClientForTest(null),
  };
}

// ============================================================================
// createTodo → todo_created + optional todo_assigned
// ============================================================================

describe('createTodo analytics', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('todo_created emitted with correct hasSprint/hasGoal/hasAssignee (no sprint/goal/assignee)', async () => {
    const { captured, restore } = await withMockSink();
    const { createTodo } = await import('@/server/actions/todos');
    const actor = await createMember('creator@analytics.test');

    const result = await createTodo({ title: 'Test todo' }, { actor });
    expect(result.ok).toBe(true);

    const createdEvent = captured.find((e) => e.event === 'todo_created');
    expect(createdEvent).toBeDefined();
    expect(createdEvent?.properties?.['hasSprint']).toBe(false);
    expect(createdEvent?.properties?.['hasGoal']).toBe(false);
    expect(createdEvent?.properties?.['hasAssignee']).toBe(false);
    expect(createdEvent?.properties?.['priority']).toBe('medium');
    restore();
  });

  test('todo_created emitted with hasSprint=true/hasGoal=true when sprint+goal attached', async () => {
    const { captured, restore } = await withMockSink();
    const { createTodo } = await import('@/server/actions/todos');
    const actor = await createMember('sprint-creator@analytics.test');
    const sprint = await seedSprint({ status: 'active', withGoals: ['Goal A'], createdByUserId: actor.id });
    const goal = sprint.goals[0]!;

    const result = await createTodo(
      { title: 'Sprinted todo', sprintId: sprint.id, sprintGoalId: goal.id },
      { actor },
    );
    expect(result.ok).toBe(true);

    const createdEvent = captured.find((e) => e.event === 'todo_created');
    expect(createdEvent?.properties?.['hasSprint']).toBe(true);
    expect(createdEvent?.properties?.['hasGoal']).toBe(true);
    restore();
  });

  test('todo_assigned also emitted when assignee is set and differs from actor', async () => {
    const { captured, restore } = await withMockSink();
    const { createTodo } = await import('@/server/actions/todos');
    const actor = await createMember('assigner@analytics.test');
    const assignee = await createMember('assignee@analytics.test');

    const result = await createTodo(
      { title: 'Assigned todo', assigneeUserId: assignee.id },
      { actor },
    );
    expect(result.ok).toBe(true);

    expect(captured.filter((e) => e.event === 'todo_created')).toHaveLength(1);
    const assignedEvent = captured.find((e) => e.event === 'todo_assigned');
    expect(assignedEvent).toBeDefined();
    expect(assignedEvent?.properties?.['assigneeUserId']).toBe(assignee.id);
    restore();
  });

  test('no event emitted when Zod validation fails (e.g. title missing)', async () => {
    const { captured, restore } = await withMockSink();
    const { createTodo } = await import('@/server/actions/todos');
    const actor = await createMember('fail-creator@analytics.test');

    const result = await createTodo({ title: '' }, { actor }); // empty title fails Zod
    expect(result.ok).toBe(false);
    expect(captured.filter((e) => e.event === 'todo_created')).toHaveLength(0);
    restore();
  });
});

// ============================================================================
// updateTodo → todo_status_changed
// ============================================================================

describe('updateTodo analytics', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('todo_status_changed emitted on status change', async () => {
    const { captured, restore } = await withMockSink();
    const { updateTodo } = await import('@/server/actions/todos');
    const actor = await createMember('status-changer@analytics.test');
    const todo = await seedTodo({ createdByUserId: actor.id, status: 'todo' });

    const result = await updateTodo({ id: todo.id, status: 'in_progress' }, { actor });
    expect(result.ok).toBe(true);

    const statusEvent = captured.find((e) => e.event === 'todo_status_changed');
    expect(statusEvent).toBeDefined();
    expect(statusEvent?.properties?.['from']).toBe('todo');
    expect(statusEvent?.properties?.['to']).toBe('in_progress');
    restore();
  });

  test('no status_changed event when status not in update payload', async () => {
    const { captured, restore } = await withMockSink();
    const { updateTodo } = await import('@/server/actions/todos');
    const actor = await createMember('no-status@analytics.test');
    const todo = await seedTodo({ createdByUserId: actor.id });

    await updateTodo({ id: todo.id, title: 'New title' }, { actor });

    expect(captured.filter((e) => e.event === 'todo_status_changed')).toHaveLength(0);
    restore();
  });

  test('todo_assigned emitted on assignee change via updateTodo', async () => {
    const { captured, restore } = await withMockSink();
    const { updateTodo } = await import('@/server/actions/todos');
    const actor = await createMember('updater@analytics.test');
    const assignee = await createMember('new-assignee@analytics.test');
    const todo = await seedTodo({ createdByUserId: actor.id });

    await updateTodo({ id: todo.id, assigneeUserId: assignee.id }, { actor });

    const assignedEvent = captured.find((e) => e.event === 'todo_assigned');
    expect(assignedEvent).toBeDefined();
    expect(assignedEvent?.properties?.['assigneeUserId']).toBe(assignee.id);
    restore();
  });
});

// ============================================================================
// postComment → comment_posted
// ============================================================================

describe('postComment analytics', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('comment_posted emitted with todoId and length bucket', async () => {
    const { captured, restore } = await withMockSink();
    const { postComment } = await import('@/server/actions/comments');
    const actor = await createMember('commenter@analytics.test');
    const todo = await seedTodo({ createdByUserId: actor.id });

    const result = await postComment({ todoId: todo.id, body: 'Hello world' }, { actor });
    expect(result.ok).toBe(true);

    const commentEvent = captured.find((e) => e.event === 'comment_posted');
    expect(commentEvent).toBeDefined();
    expect(commentEvent?.properties?.['todoId']).toBe(todo.id);
    expect(commentEvent?.properties?.['commentLengthBucket']).toBe('s');
    restore();
  });

  test('no comment_posted event on validation failure (body too long)', async () => {
    const { captured, restore } = await withMockSink();
    const { postComment } = await import('@/server/actions/comments');
    const actor = await createMember('fail-commenter@analytics.test');
    const todo = await seedTodo({ createdByUserId: actor.id });

    const result = await postComment({ todoId: todo.id, body: 'x'.repeat(2001) }, { actor });
    expect(result.ok).toBe(false);
    expect(captured.filter((e) => e.event === 'comment_posted')).toHaveLength(0);
    restore();
  });
});

// ============================================================================
// markNotificationRead → notification_opened
// ============================================================================

describe('markNotificationRead analytics', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('notification_opened emitted on mark-read', async () => {
    const { captured, restore } = await withMockSink();
    const { markNotificationRead } = await import('@/server/actions/notifications');
    const actor = await createMember('notif-reader@analytics.test');
    const todo = await seedTodo({ createdByUserId: actor.id });

    // Seed a notification for this user
    const db = getDb();
    const notif = await db.notification.create({
      data: {
        userId: actor.id,
        kind: 'assigned',
        targetTodoId: todo.id,
        triggeredByUserId: null,
        readAt: null,
      },
    });

    const result = await markNotificationRead({ id: notif.id }, { actor });
    expect(result.ok).toBe(true);

    const openedEvent = captured.find((e) => e.event === 'notification_opened');
    expect(openedEvent).toBeDefined();
    expect(openedEvent?.properties?.['notificationId']).toBe(notif.id);
    expect(openedEvent?.properties?.['kind']).toBe('assigned');
    restore();
  });
});
