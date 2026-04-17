/**
 * Integration tests for Phase 6: Notifications (FR-25, FR-26, FR-27)
 *
 * FR-25: assigned + comment_on_assigned notification creation; due-soon sweep.
 * FR-26: listNotifications, markNotificationRead, markAllNotificationsRead.
 * FR-27: forbidden import grep (no external notification services).
 *
 * Runs against a real Postgres database (Testcontainers).
 */
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  createMember,
  resetDb,
  resetDbClient,
  getDb,
  seedTodo,
  seedNotification,
} from '../support/fixtures';
import { resetPrismaClient } from '@/server/db/client';
import { createTodo, updateTodo } from '@/server/actions/todos';
import { postComment } from '@/server/actions/comments';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '@/server/actions/notifications';
import { sweepDueSoonNotifications } from '@/server/jobs/sweep-due-soon';

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

beforeEach(async () => {
  await resetDb();
});

// ============================================================================
// FR-25: Assigned notifications
// ============================================================================

describe('FR-25: assigned notifications', () => {
  test('createTodo with assignee creates an assigned notification for the assignee', async () => {
    const actor = await createMember();
    const assignee = await createMember();

    const result = await createTodo(
      {
        title: 'Test todo',
        assigneeUserId: assignee.id,
      },
      { actor },
    );

    expect(result.ok).toBe(true);

    const db = getDb();
    const notifications = await db.notification.findMany({
      where: { userId: assignee.id, kind: 'assigned' },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.targetTodoId).toBe((result as { ok: true; data: { todo: { id: string } } }).data.todo.id);
    expect(notifications[0]?.triggeredByUserId).toBe(actor.id);
    expect(notifications[0]?.readAt).toBeNull();
  });

  test('createTodo where actor is assignee does NOT create a notification', async () => {
    const actor = await createMember();

    const result = await createTodo(
      {
        title: 'Self-assigned todo',
        assigneeUserId: actor.id,
      },
      { actor },
    );

    expect(result.ok).toBe(true);

    const db = getDb();
    const notifications = await db.notification.findMany({
      where: { userId: actor.id, kind: 'assigned' },
    });
    expect(notifications).toHaveLength(0);
  });

  test('updateTodo changing assignee creates assigned notification for new assignee', async () => {
    const actor = await createMember();
    const oldAssignee = await createMember();
    const newAssignee = await createMember();

    const todo = await seedTodo({ assigneeUserId: oldAssignee.id, createdByUserId: actor.id });

    const result = await updateTodo(
      { id: todo.id, assigneeUserId: newAssignee.id },
      { actor },
    );

    expect(result.ok).toBe(true);

    const db = getDb();
    const notifications = await db.notification.findMany({
      where: { userId: newAssignee.id, kind: 'assigned' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.targetTodoId).toBe(todo.id);
  });

  test('updateTodo with same assignee does NOT create a duplicate notification', async () => {
    const actor = await createMember();
    const assignee = await createMember();

    const todo = await seedTodo({ assigneeUserId: assignee.id, createdByUserId: actor.id });

    // Update without changing assignee — no assigneeUserId in input
    await updateTodo(
      { id: todo.id, title: 'Updated title' },
      { actor },
    );

    const db = getDb();
    const notifications = await db.notification.findMany({
      where: { userId: assignee.id, kind: 'assigned' },
    });
    // seedTodo bypasses the action, so no notification was created initially
    expect(notifications).toHaveLength(0);
  });
});

// ============================================================================
// FR-25: comment_on_assigned notifications
// ============================================================================

describe('FR-25: comment_on_assigned notifications', () => {
  test('postComment on todo assigned to someone else creates comment_on_assigned notification', async () => {
    const actor = await createMember();
    const assignee = await createMember();
    const todo = await seedTodo({ assigneeUserId: assignee.id, createdByUserId: actor.id });

    const result = await postComment(
      { todoId: todo.id, body: 'Nice work!' },
      { actor },
    );

    expect(result.ok).toBe(true);

    const db = getDb();
    const notifications = await db.notification.findMany({
      where: { userId: assignee.id, kind: 'comment_on_assigned' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.targetTodoId).toBe(todo.id);
    expect(notifications[0]?.triggeredByUserId).toBe(actor.id);
  });

  test('postComment where author IS the assignee does NOT create notification', async () => {
    const assignee = await createMember();
    const todo = await seedTodo({ assigneeUserId: assignee.id, createdByUserId: assignee.id });

    const result = await postComment(
      { todoId: todo.id, body: 'I will handle this.' },
      { actor: assignee },
    );

    expect(result.ok).toBe(true);

    const db = getDb();
    const notifications = await db.notification.findMany({
      where: { userId: assignee.id, kind: 'comment_on_assigned' },
    });
    expect(notifications).toHaveLength(0);
  });

  test('postComment on todo with no assignee does NOT create notification', async () => {
    const actor = await createMember();
    const todo = await seedTodo({ assigneeUserId: null, createdByUserId: actor.id });

    await postComment(
      { todoId: todo.id, body: 'Unassigned comment' },
      { actor },
    );

    const db = getDb();
    const count = await db.notification.count({ where: { kind: 'comment_on_assigned' } });
    expect(count).toBe(0);
  });
});

// ============================================================================
// FR-25: due-soon sweep
// ============================================================================

describe('FR-25: due-soon sweep', () => {
  test('sweepDueSoonNotifications creates a due_soon notification for overdue todo', async () => {
    const assignee = await createMember();
    // due_date 6 hours from now — within the "due today or earlier" window
    // We set due_date to yesterday to be safe (definitely <= tomorrow)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dueDateStr = yesterday.toISOString().substring(0, 10);

    await seedTodo({
      assigneeUserId: assignee.id,
      dueDate: dueDateStr,
      status: 'todo',
    });

    const result = await sweepDueSoonNotifications();
    expect(result.notificationsCreated).toBeGreaterThanOrEqual(1);

    const db = getDb();
    const notifications = await db.notification.findMany({
      where: { userId: assignee.id, kind: 'due_soon' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
  });

  test('sweepDueSoonNotifications is idempotent (second run does not double-insert)', async () => {
    const assignee = await createMember();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dueDateStr = yesterday.toISOString().substring(0, 10);

    await seedTodo({
      assigneeUserId: assignee.id,
      dueDate: dueDateStr,
      status: 'todo',
    });

    const run1 = await sweepDueSoonNotifications();
    expect(run1.notificationsCreated).toBeGreaterThanOrEqual(1);

    const run2 = await sweepDueSoonNotifications();
    expect(run2.notificationsCreated).toBe(0); // partial unique index prevents re-insert

    const db = getDb();
    const notifications = await db.notification.findMany({
      where: { userId: assignee.id, kind: 'due_soon' },
    });
    // Still exactly the same rows — no duplicates
    expect(notifications).toHaveLength(run1.notificationsCreated);
  });

  test('sweepDueSoonNotifications ignores status=done todos', async () => {
    const assignee = await createMember();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dueDateStr = yesterday.toISOString().substring(0, 10);

    await seedTodo({
      assigneeUserId: assignee.id,
      dueDate: dueDateStr,
      status: 'done',
    });

    const result = await sweepDueSoonNotifications();
    expect(result.notificationsCreated).toBe(0);
  });

  test('sweepDueSoonNotifications ignores todos without assignee', async () => {
    const creator = await createMember();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dueDateStr = yesterday.toISOString().substring(0, 10);

    await seedTodo({
      assigneeUserId: null,
      dueDate: dueDateStr,
      status: 'todo',
      createdByUserId: creator.id,
    });

    const result = await sweepDueSoonNotifications();
    expect(result.notificationsCreated).toBe(0);
  });
});

// ============================================================================
// FR-26: listNotifications, markNotificationRead, markAllNotificationsRead
// ============================================================================

describe('FR-26: notification actions', () => {
  test('listNotifications returns last 20 items + correct unreadCount', async () => {
    const user = await createMember();
    const creator = await createMember();

    // Create 22 notifications — only last 20 should be returned
    const todos = [];
    for (let i = 0; i < 22; i++) {
      const todo = await seedTodo({ createdByUserId: creator.id });
      todos.push(todo);
    }

    for (let i = 0; i < 22; i++) {
      await seedNotification({
        userId: user.id,
        targetTodoId: todos[i]!.id,
        kind: 'assigned',
        createdAt: new Date(Date.now() + i * 1000), // ensure ordering
      });
    }

    const result = await listNotifications({}, { actor: user });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.items).toHaveLength(20);
    expect(result.data.unreadCount).toBe(22); // all unread, exceeds 20
  });

  test('markNotificationRead sets read_at', async () => {
    const user = await createMember();
    const creator = await createMember();
    const todo = await seedTodo({ createdByUserId: creator.id });
    const notification = await seedNotification({ userId: user.id, targetTodoId: todo.id });

    expect(notification.readAt).toBeNull();

    const result = await markNotificationRead({ id: notification.id }, { actor: user });
    expect(result.ok).toBe(true);

    const db = getDb();
    const updated = await db.notification.findUnique({ where: { id: notification.id } });
    expect(updated?.readAt).not.toBeNull();
  });

  test('markNotificationRead is forbidden for other users', async () => {
    const owner = await createMember();
    const other = await createMember();
    const creator = await createMember();
    const todo = await seedTodo({ createdByUserId: creator.id });
    const notification = await seedNotification({ userId: owner.id, targetTodoId: todo.id });

    const result = await markNotificationRead({ id: notification.id }, { actor: other });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('forbidden');
  });

  test('markAllNotificationsRead respects upToCreatedAt boundary', async () => {
    const user = await createMember();
    const creator = await createMember();
    const todo1 = await seedTodo({ createdByUserId: creator.id });
    const todo2 = await seedTodo({ createdByUserId: creator.id });

    const earlyTime = new Date('2026-01-01T10:00:00.000Z');
    const lateTime = new Date('2026-01-01T11:00:00.000Z');
    const boundary = new Date('2026-01-01T10:30:00.000Z');

    const early = await seedNotification({ userId: user.id, targetTodoId: todo1.id, createdAt: earlyTime });
    const late = await seedNotification({ userId: user.id, targetTodoId: todo2.id, createdAt: lateTime });

    const result = await markAllNotificationsRead(
      { upToCreatedAt: boundary.toISOString() },
      { actor: user },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.markedCount).toBe(1); // only the early one

    const db = getDb();
    const earlyRow = await db.notification.findUnique({ where: { id: early.id } });
    const lateRow = await db.notification.findUnique({ where: { id: late.id } });

    expect(earlyRow?.readAt).not.toBeNull();
    expect(lateRow?.readAt).toBeNull(); // NOT marked read
  });

  test('markAllNotificationsRead race — notification after boundary is NOT marked read', async () => {
    const user = await createMember();
    const creator = await createMember();
    const todo1 = await seedTodo({ createdByUserId: creator.id });
    const todo2 = await seedTodo({ createdByUserId: creator.id });

    const listTime = new Date();
    // Notification that arrived AFTER the user saw the list
    await seedNotification({
      userId: user.id,
      targetTodoId: todo1.id,
      createdAt: new Date(listTime.getTime() - 5000),
    });
    const afterBoundary = await seedNotification({
      userId: user.id,
      targetTodoId: todo2.id,
      createdAt: new Date(listTime.getTime() + 5000), // arrived after
    });

    // Mark all up to listTime
    await markAllNotificationsRead(
      { upToCreatedAt: listTime.toISOString() },
      { actor: user },
    );

    const db = getDb();
    const afterRow = await db.notification.findUnique({ where: { id: afterBoundary.id } });
    expect(afterRow?.readAt).toBeNull(); // must still be unread
  });
});

// ============================================================================
// FR-27: forbidden imports grep
// ============================================================================

describe('FR-27: no external notification imports', () => {
  test('src/ contains no imports of forbidden external notification packages', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const forbiddenPatterns = [
      /\bnodemailer\b/,
      /\bsendgrid\b/,
      /\bslack\b/,
      /\btwilio\b/,
      /\bfirebase-messaging\b/,
      /\b@sendgrid\b/,
      /\bsgMail\b/,
    ];

    function walkDir(dir: string): string[] {
      const files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...walkDir(fullPath));
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const allFiles = walkDir(srcDir);
    const violations: string[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`${file}: matched ${pattern}`);
        }
      }
    }

    expect(violations).toHaveLength(0);
  });
});
