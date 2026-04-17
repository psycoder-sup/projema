/**
 * Integration tests for Phase 3: Todos core
 * FR-11..FR-17, FR-23, FR-24
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
  seedTodoLink,
  seedTodoDocument,
  deactivateUser,
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
// FR-11: todo field validation
// ============================================================================

describe('FR-11: todo field validation', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('title over 140 chars rejected', async () => {
    const { createTodo } = await import('@/server/actions/todos');
    const actor = await createMember();
    const res = await createTodo({ title: 'x'.repeat(141) }, { actor });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('validation_failed');
      if (res.error.code === 'validation_failed') {
        expect(res.error.field).toBe('title');
      }
    }
  });

  test('title at exactly 140 chars is accepted', async () => {
    const { createTodo } = await import('@/server/actions/todos');
    const actor = await createMember();
    const res = await createTodo({ title: 'x'.repeat(140) }, { actor });
    expect(res.ok).toBe(true);
  });

  test('description over 4000 chars rejected', async () => {
    const { createTodo } = await import('@/server/actions/todos');
    const actor = await createMember();
    const res = await createTodo(
      { title: 'T', description: 'a'.repeat(4001) },
      { actor },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('validation_failed');
  });

  test('markdown document > 100KB rejected', async () => {
    const { saveTodoDocument } = await import('@/server/actions/todos');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    const big = 'a'.repeat(100 * 1024 + 1);
    const res = await saveTodoDocument({ todoId: todo.id, contentMarkdown: big }, { actor });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('document_too_large');
  });

  test('assignee must be an existing, active org member', async () => {
    const { createTodo } = await import('@/server/actions/todos');

    // Non-existent user id rejected
    const bogus = '00000000-0000-0000-0000-000000000000';
    const actor = await createMember();
    const r1 = await createTodo({ title: 'T', assigneeUserId: bogus }, { actor });
    expect(r1.ok).toBe(false);
    if (!r1.ok && r1.error.code === 'validation_failed') {
      expect(r1.error.field).toBe('assigneeUserId');
    }

    // Deactivated user rejected
    const inactive = await createMember('gone-fr11@x.test');
    await deactivateUser(inactive);
    const r2 = await createTodo({ title: 'T2', assigneeUserId: inactive.id }, { actor });
    expect(r2.ok).toBe(false);
    if (!r2.ok && r2.error.code === 'validation_failed') {
      expect(r2.error.field).toBe('assigneeUserId');
    }
  });

  test('createTodo with valid data succeeds and returns todo with links', async () => {
    const { createTodo } = await import('@/server/actions/todos');
    const actor = await createMember();
    const res = await createTodo(
      {
        title: 'New Todo',
        description: 'Some description',
        status: 'todo',
        priority: 'high',
        links: [{ url: 'https://example.com', label: 'Docs' }],
      },
      { actor },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.todo.title).toBe('New Todo');
      expect(res.data.todo.links).toHaveLength(1);
      expect(res.data.todo.links[0]?.url).toBe('https://example.com');
    }
  });
});

// ============================================================================
// FR-11 PATCH semantics: key-absent vs null for nullable fields
// ============================================================================

describe('FR-11 PATCH semantics: key-absent vs null for nullable fields', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('omitting assigneeUserId leaves the existing assignee unchanged', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const a = await createMember('a-patch1@x.test');
    const todo = await seedTodo({ assigneeUserId: a.id });
    const res = await updateTodo(
      { id: todo.id, title: 'renamed' }, // no assigneeUserId key
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.assigneeUserId).toBe(a.id);
  });

  test('sending assigneeUserId: null clears the assignee', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const a = await createMember('a2-patch2@x.test');
    const todo = await seedTodo({ assigneeUserId: a.id });
    const res = await updateTodo(
      { id: todo.id, assigneeUserId: null },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.assigneeUserId).toBeNull();
  });

  test('omitting description leaves the existing description unchanged', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const todo = await seedTodo({ description: 'original desc' });
    const res = await updateTodo(
      { id: todo.id, title: 'new title' }, // no description key
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.description).toBe('original desc');
  });

  test('sending description: null clears the description', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const todo = await seedTodo({ description: 'to be cleared' });
    const res = await updateTodo(
      { id: todo.id, description: null },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.description).toBeNull();
  });

  test('omitting dueDate leaves the existing dueDate unchanged', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const todo = await seedTodo({ dueDate: '2026-06-01' });
    const res = await updateTodo(
      { id: todo.id, title: 'title only' },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.dueDate).not.toBeNull();
  });

  test('sending dueDate: null clears the dueDate', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const todo = await seedTodo({ dueDate: '2026-06-01' });
    const res = await updateTodo(
      { id: todo.id, dueDate: null },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.dueDate).toBeNull();
  });
});

// ============================================================================
// FR-12: todo sprint/goal integrity
// ============================================================================

describe('FR-12: todo sprint/goal integrity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('attaching a goal from a different sprint is rejected', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const s1 = await seedSprint({ withGoals: ['A'] });
    const s2 = await seedSprint({ withGoals: ['B'] });
    const todo = await seedTodo({ sprintId: s1.id });

    const res = await updateTodo(
      { id: todo.id, sprintGoalId: s2.goals[0]?.id },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(false);
  });

  test('todo can have sprintGoalId only if sprint_id belongs to same sprint', async () => {
    const { createTodo } = await import('@/server/actions/todos');
    const s = await seedSprint({ withGoals: ['G'] });
    const actor = await createMember();

    const res = await createTodo(
      { title: 'T', sprintId: s.id, sprintGoalId: s.goals[0]?.id },
      { actor },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.todo.sprintId).toBe(s.id);
      expect(res.data.todo.sprintGoalId).toBe(s.goals[0]?.id);
    }
  });
});

// ============================================================================
// FR-13: backlog is sprintId=null
// ============================================================================

describe('FR-13: backlog is sprintId=null', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('backlog list returns only unattached todos', async () => {
    const { listTodos } = await import('@/server/actions/todos');
    const s = await seedSprint();
    await seedTodo({ sprintId: s.id });
    const backlogTodo = await seedTodo();
    const res = await listTodos(
      { filter: { sprintScope: { kind: 'backlog' } } },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.map((t) => t.id)).toContain(backlogTodo.id);
      expect(res.data.map((t) => t.id)).not.toContain(
        (await getDb().todo.findFirst({ where: { sprintId: s.id } }))?.id,
      );
    }
  });

  test('backlog list excludes sprint-attached todos', async () => {
    const { listTodos } = await import('@/server/actions/todos');
    const s = await seedSprint();
    await seedTodo({ sprintId: s.id });
    await seedTodo({ sprintId: s.id });
    const backlogTodo = await seedTodo({ sprintId: null });
    const res = await listTodos(
      { filter: { sprintScope: { kind: 'backlog' } } },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.id).toBe(backlogTodo.id);
    }
  });
});

// ============================================================================
// FR-14: any member can edit/delete any todo
// ============================================================================

describe('FR-14: any member can edit/delete any todo', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("member can delete another member's todo", async () => {
    const { deleteTodo } = await import('@/server/actions/todos');
    const owner = await createMember('o-fr14@example.com');
    const other = await createMember('x-fr14@example.com');
    const todo = await seedTodo({ createdByUserId: owner.id });
    const res = await deleteTodo({ id: todo.id }, { actor: other });
    expect(res.ok).toBe(true);
  });

  test("member can update another member's todo", async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const owner = await createMember('o2-fr14@example.com');
    const other = await createMember('x2-fr14@example.com');
    const todo = await seedTodo({ createdByUserId: owner.id });
    const res = await updateTodo({ id: todo.id, title: 'Changed' }, { actor: other });
    expect(res.ok).toBe(true);
  });

  test('deleteTodo cascades to links and document', async () => {
    const { deleteTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const actor = await createMember();
    const todo = await seedTodo();
    await seedTodoLink({ todoId: todo.id, url: 'https://example.com' });
    await seedTodoDocument({ todoId: todo.id, contentMarkdown: '# doc', updatedByUserId: actor.id });

    const res = await deleteTodo({ id: todo.id }, { actor });
    expect(res.ok).toBe(true);

    const links = await db.todoLink.findMany({ where: { todoId: todo.id } });
    const doc = await db.todoDocument.findUnique({ where: { todoId: todo.id } });
    expect(links).toHaveLength(0);
    expect(doc).toBeNull();
  });
});

// ============================================================================
// FR-15: completion timestamp
// ============================================================================

describe('FR-15: completion timestamp', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('marking done sets completed_at', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const todo = await seedTodo({ status: 'todo' });
    const res = await updateTodo({ id: todo.id, status: 'done' }, { actor: await createMember() });
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.completedAt).toBeInstanceOf(Date);
  });

  test('reopening from done clears completed_at', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const todo = await seedTodo({ status: 'done', completedAt: new Date() });
    const res = await updateTodo(
      { id: todo.id, status: 'in_progress' },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.completedAt).toBeNull();
  });

  test('updating to in_progress clears completed_at', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const todo = await seedTodo({ status: 'done', completedAt: new Date() });
    const res = await updateTodo(
      { id: todo.id, status: 'todo' },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.completedAt).toBeNull();
  });
});

// ============================================================================
// FR-16: detaching sprint clears goal
// ============================================================================

describe('FR-16: detaching sprint clears goal', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('setting sprintId=null also clears sprintGoalId', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const s = await seedSprint({ withGoals: ['G'] });
    const todo = await seedTodo({
      sprintId: s.id,
      sprintGoalId: s.goals[0]?.id ?? null,
    });
    const res = await updateTodo(
      { id: todo.id, sprintId: null },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.sprintId).toBeNull();
    expect(after?.sprintGoalId).toBeNull();
  });

  test('clearing sprintGoalId alone leaves sprintId intact', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const s = await seedSprint({ withGoals: ['G'] });
    const todo = await seedTodo({
      sprintId: s.id,
      sprintGoalId: s.goals[0]?.id ?? null,
    });
    const res = await updateTodo(
      { id: todo.id, sprintGoalId: null },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.sprintId).toBe(s.id);
    expect(after?.sprintGoalId).toBeNull();
  });
});

// ============================================================================
// FR-17: markdown rendering + sanitization
// ============================================================================

describe('FR-17: markdown document handling', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('saveTodoDocument saves content and returns it', async () => {
    const { saveTodoDocument } = await import('@/server/actions/todos');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    const content = '# Title\n\nSome **bold** text.';
    const res = await saveTodoDocument(
      { todoId: todo.id, contentMarkdown: content },
      { actor },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.doc.contentMarkdown).toBe(content);
      expect(res.data.doc.updatedAt).toBeInstanceOf(Date);
    }
  });

  test('saveTodoDocument oversize (>100KB) returns document_too_large', async () => {
    const { saveTodoDocument } = await import('@/server/actions/todos');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    const big = 'a'.repeat(100 * 1024 + 1);
    const res = await saveTodoDocument(
      { todoId: todo.id, contentMarkdown: big },
      { actor },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('document_too_large');
  });

  test('saveTodoDocument at exactly 100KB succeeds', async () => {
    const { saveTodoDocument } = await import('@/server/actions/todos');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    // 100KB exactly in bytes
    const content = 'a'.repeat(100 * 1024);
    const res = await saveTodoDocument(
      { todoId: todo.id, contentMarkdown: content },
      { actor },
    );
    expect(res.ok).toBe(true);
  });

  test('saveTodoDocument is an upsert (overwrites on second save)', async () => {
    const { saveTodoDocument } = await import('@/server/actions/todos');
    const db = getDb();
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });

    await saveTodoDocument({ todoId: todo.id, contentMarkdown: 'first' }, { actor });
    await saveTodoDocument({ todoId: todo.id, contentMarkdown: 'second' }, { actor });

    const doc = await db.todoDocument.findUnique({ where: { todoId: todo.id } });
    expect(doc?.contentMarkdown).toBe('second');
  });

  test('deleteTodoDocument removes the doc', async () => {
    const { saveTodoDocument, deleteTodoDocument } = await import('@/server/actions/todos');
    const db = getDb();
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    await saveTodoDocument({ todoId: todo.id, contentMarkdown: '# hi' }, { actor });
    const res = await deleteTodoDocument({ todoId: todo.id }, { actor });
    expect(res.ok).toBe(true);
    const doc = await db.todoDocument.findUnique({ where: { todoId: todo.id } });
    expect(doc).toBeNull();
  });
});

// ============================================================================
// FR-11/Security: todo_links.url scheme restriction
// ============================================================================

describe('FR-11/Security: todo_links.url scheme restriction', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test.each(['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd'])(
    'rejects %s',
    async (url) => {
      const { addTodoLink } = await import('@/server/actions/todos');
      const actor = await createMember();
      const todo = await seedTodo();
      const res = await addTodoLink({ todoId: todo.id, url }, { actor });
      expect(res.ok).toBe(false);
      if (!res.ok && res.error.code === 'validation_failed') {
        expect(res.error.field).toBe('url');
      }
    },
  );

  test('accepts http, https, mailto URLs', async () => {
    const { addTodoLink } = await import('@/server/actions/todos');
    const actor = await createMember();
    const todo = await seedTodo();
    for (const url of ['https://example.com', 'http://intranet.local', 'mailto:a@b.c']) {
      const res = await addTodoLink({ todoId: todo.id, url }, { actor });
      expect(res.ok).toBe(true);
    }
  });

  test('removeTodoLink deletes the link', async () => {
    const { removeTodoLink } = await import('@/server/actions/todos');
    const db = getDb();
    const actor = await createMember();
    const todo = await seedTodo();
    const link = await seedTodoLink({ todoId: todo.id, url: 'https://example.com' });
    const res = await removeTodoLink({ linkId: link.id }, { actor });
    expect(res.ok).toBe(true);
    const dbLink = await db.todoLink.findUnique({ where: { id: link.id } });
    expect(dbLink).toBeNull();
  });
});

// ============================================================================
// FR-23: backlog filters
// ============================================================================

describe('FR-23: backlog filters', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('priority filter narrows backlog results', async () => {
    const { listTodos } = await import('@/server/actions/todos');
    await seedTodo({ priority: 'high' });
    await seedTodo({ priority: 'low' });
    await seedTodo({ priority: 'high' });
    const res = await listTodos(
      { filter: { sprintScope: { kind: 'backlog' }, priority: 'high' } },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.every((t) => t.priority === 'high')).toBe(true);
    }
  });

  test('status filter narrows backlog results', async () => {
    const { listTodos } = await import('@/server/actions/todos');
    await seedTodo({ status: 'done' });
    await seedTodo({ status: 'in_progress' });
    const res = await listTodos(
      { filter: { sprintScope: { kind: 'backlog' }, status: 'done' } },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.every((t) => t.status === 'done')).toBe(true);
    }
  });

  test('backlog with no filters returns all unattached todos', async () => {
    const { listTodos } = await import('@/server/actions/todos');
    const s = await seedSprint();
    await seedTodo({ sprintId: s.id }); // in sprint — excluded
    await seedTodo(); // backlog
    await seedTodo(); // backlog
    const res = await listTodos(
      { filter: { sprintScope: { kind: 'backlog' } } },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(2);
      expect(res.data.every((t) => t.sprintId === null)).toBe(true);
    }
  });
});

// ============================================================================
// FR-24: my todos spans sprints and backlog
// ============================================================================

describe('FR-24: my todos spans sprints and backlog', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('returns todos assigned to current user across sprint and backlog', async () => {
    const { listTodos } = await import('@/server/actions/todos');
    const me = await createMember('me-fr24@test.com');
    const s = await seedSprint();
    await seedTodo({ assigneeUserId: me.id, sprintId: s.id });
    await seedTodo({ assigneeUserId: me.id, sprintId: null });
    await seedTodo({ assigneeUserId: null }); // not mine
    const res = await listTodos(
      { filter: { assigneeUserId: me.id, sprintScope: { kind: 'any' } } },
      { actor: me },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(2);
      expect(res.data.every((t) => t.assigneeUserId === me.id)).toBe(true);
    }
  });

  test('my todos sorted by dueDate asc, nulls last', async () => {
    const { listTodos } = await import('@/server/actions/todos');
    const me = await createMember('me2-fr24@test.com');
    await seedTodo({ assigneeUserId: me.id, dueDate: null });
    await seedTodo({ assigneeUserId: me.id, dueDate: '2026-06-15' });
    await seedTodo({ assigneeUserId: me.id, dueDate: '2026-06-01' });
    const res = await listTodos(
      { filter: { assigneeUserId: me.id, sprintScope: { kind: 'any' } } },
      { actor: me },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data[0]?.dueDate).toBe('2026-06-01');
      expect(res.data[1]?.dueDate).toBe('2026-06-15');
      expect(res.data[2]?.dueDate).toBeNull();
    }
  });
});

// ============================================================================
// getTodoDetail
// ============================================================================

describe('getTodoDetail', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('returns todo with links and document', async () => {
    const { getTodoDetail } = await import('@/server/actions/todos');
    const actor = await createMember();
    const todo = await seedTodo();
    await seedTodoLink({ todoId: todo.id, url: 'https://github.com' });
    await seedTodoDocument({
      todoId: todo.id,
      contentMarkdown: '# hello',
      updatedByUserId: actor.id,
    });

    const res = await getTodoDetail({ id: todo.id }, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.links).toHaveLength(1);
      expect(res.data.document?.contentMarkdown).toBe('# hello');
    }
  });

  test('returns not_found for missing todo', async () => {
    const { getTodoDetail } = await import('@/server/actions/todos');
    const actor = await createMember();
    const res = await getTodoDetail({ id: '00000000-0000-0000-0000-000000000000' }, { actor });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
  });
});

// ============================================================================
// Activity events
// ============================================================================

describe('Activity events', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('createTodo emits todo_created activity', async () => {
    const { createTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const actor = await createMember();
    const res = await createTodo({ title: 'Act todo' }, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const events = await db.activityEvent.findMany({
        where: { kind: 'todo_created', targetTodoId: res.data.todo.id },
      });
      expect(events).toHaveLength(1);
    }
  });

  test('updateTodo emits todo_status_changed on status change', async () => {
    const { updateTodo } = await import('@/server/actions/todos');
    const db = getDb();
    const actor = await createMember();
    const todo = await seedTodo({ status: 'todo' });
    await updateTodo({ id: todo.id, status: 'done' }, { actor });
    const event = await db.activityEvent.findFirst({
      where: { kind: 'todo_status_changed', targetTodoId: todo.id },
    });
    expect(event).not.toBeNull();
    expect((event?.payloadJson as Record<string, unknown>)?.from).toBe('todo');
    expect((event?.payloadJson as Record<string, unknown>)?.to).toBe('done');
  });
});
