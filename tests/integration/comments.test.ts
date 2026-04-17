/**
 * Integration tests for Phase 4: Comments
 * FR-18 (body length, ordering), FR-19 (author-only edit/delete, edited_at set),
 * plus rate-limit integration test (11 consecutive posts → 11th is rate_limited).
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
  seedTodo,
  seedComment,
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
// FR-18: comment body ≤ 2000 chars; oldest-first ordering
// ============================================================================

describe('FR-18: comments ≤ 2000 chars, ordered oldest-first', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('body over 2000 chars is rejected', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    const res = await postComment({ todoId: todo.id, body: 'x'.repeat(2001) }, { actor });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('validation_failed');
    }
  });

  test('body at exactly 2000 chars is accepted', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    const res = await postComment({ todoId: todo.id, body: 'x'.repeat(2000) }, { actor });
    expect(res.ok).toBe(true);
  });

  test('empty body is rejected', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    const res = await postComment({ todoId: todo.id, body: '' }, { actor });
    expect(res.ok).toBe(false);
  });

  test('listed comments are ordered ascending by createdAt (oldest first)', async () => {
    const { postComment, listComments } = await import('@/server/actions/comments');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });

    // Post two comments in order
    const r1 = await postComment({ todoId: todo.id, body: 'first comment' }, { actor });
    const r2 = await postComment({ todoId: todo.id, body: 'second comment' }, { actor });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const listRes = await listComments({ todoId: todo.id }, { actor });
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      const bodies = listRes.data.map((c) => c.body);
      expect(bodies).toEqual(['first comment', 'second comment']);
    }
  });

  test('seeded comments via fixture appear in correct order', async () => {
    const { listComments } = await import('@/server/actions/comments');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });

    const t1 = new Date(Date.now() - 2000);
    const t2 = new Date(Date.now() - 1000);
    const t3 = new Date();

    await seedComment({ todoId: todo.id, authorUserId: actor.id, body: 'oldest', createdAt: t1 });
    await seedComment({ todoId: todo.id, authorUserId: actor.id, body: 'middle', createdAt: t2 });
    await seedComment({ todoId: todo.id, authorUserId: actor.id, body: 'newest', createdAt: t3 });

    const listRes = await listComments({ todoId: todo.id }, { actor });
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      expect(listRes.data.map((c) => c.body)).toEqual(['oldest', 'middle', 'newest']);
    }
  });

  test('postComment on non-existent todo returns not_found', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const actor = await createMember();
    const res = await postComment(
      { todoId: '00000000-0000-0000-0000-000000000000', body: 'hi' },
      { actor },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
  });

  test('postComment emits comment_posted activity event', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const db = getDb();
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    const res = await postComment({ todoId: todo.id, body: 'activity test' }, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const events = await db.activityEvent.findMany({
        where: { kind: 'comment_posted', targetTodoId: todo.id },
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.actorUserId).toBe(actor.id);
    }
  });
});

// ============================================================================
// FR-19: only author edits/deletes own comment; edited_at set on edit
// ============================================================================

describe('FR-19: only author edits/deletes own comment; edited_at set', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('non-author edit is rejected with forbidden', async () => {
    const { postComment, editComment } = await import('@/server/actions/comments');
    const author = await createMember('author-fr19a@test.com');
    const other = await createMember('other-fr19a@test.com');
    const todo = await seedTodo({ createdByUserId: author.id });

    const postRes = await postComment({ todoId: todo.id, body: 'original' }, { actor: author });
    expect(postRes.ok).toBe(true);
    if (!postRes.ok) return;

    const editRes = await editComment({ id: postRes.data.comment.id, body: 'tampered' }, { actor: other });
    expect(editRes.ok).toBe(false);
    if (!editRes.ok) expect(editRes.error.code).toBe('forbidden');
  });

  test('non-author delete is rejected with forbidden', async () => {
    const { postComment, deleteComment } = await import('@/server/actions/comments');
    const author = await createMember('author-fr19b@test.com');
    const other = await createMember('other-fr19b@test.com');
    const todo = await seedTodo({ createdByUserId: author.id });

    const postRes = await postComment({ todoId: todo.id, body: 'will survive' }, { actor: author });
    expect(postRes.ok).toBe(true);
    if (!postRes.ok) return;

    const delRes = await deleteComment({ id: postRes.data.comment.id }, { actor: other });
    expect(delRes.ok).toBe(false);
    if (!delRes.ok) expect(delRes.error.code).toBe('forbidden');
  });

  test('author edit sets editedAt', async () => {
    const { postComment, editComment } = await import('@/server/actions/comments');
    const author = await createMember('author-fr19c@test.com');
    const todo = await seedTodo({ createdByUserId: author.id });

    const postRes = await postComment({ todoId: todo.id, body: 'original' }, { actor: author });
    expect(postRes.ok).toBe(true);
    if (!postRes.ok) return;

    const editRes = await editComment({ id: postRes.data.comment.id, body: 'edited' }, { actor: author });
    expect(editRes.ok).toBe(true);
    if (editRes.ok) {
      expect(editRes.data.comment.editedAt).toBeInstanceOf(Date);
      expect(editRes.data.comment.body).toBe('edited');
    }
  });

  test('editedAt is null on a fresh (unedited) comment', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });
    const res = await postComment({ todoId: todo.id, body: 'fresh' }, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.comment.editedAt).toBeNull();
    }
  });

  test('author delete removes the comment', async () => {
    const { postComment, deleteComment, listComments } = await import('@/server/actions/comments');
    const author = await createMember('author-fr19d@test.com');
    const todo = await seedTodo({ createdByUserId: author.id });

    const postRes = await postComment({ todoId: todo.id, body: 'to delete' }, { actor: author });
    expect(postRes.ok).toBe(true);
    if (!postRes.ok) return;

    const delRes = await deleteComment({ id: postRes.data.comment.id }, { actor: author });
    expect(delRes.ok).toBe(true);

    const listRes = await listComments({ todoId: todo.id }, { actor: author });
    expect(listRes.ok).toBe(true);
    if (listRes.ok) expect(listRes.data).toHaveLength(0);
  });

  test('edit on non-existent comment returns not_found', async () => {
    const { editComment } = await import('@/server/actions/comments');
    const actor = await createMember();
    const res = await editComment(
      { id: '00000000-0000-0000-0000-000000000000', body: 'x' },
      { actor },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
  });

  test('getTodoDetail includes comments sorted oldest-first', async () => {
    const { getTodoDetail } = await import('@/server/actions/todos');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });

    const t1 = new Date(Date.now() - 2000);
    const t2 = new Date(Date.now() - 1000);
    await seedComment({ todoId: todo.id, authorUserId: actor.id, body: 'first', createdAt: t1 });
    await seedComment({ todoId: todo.id, authorUserId: actor.id, body: 'second', createdAt: t2 });

    const res = await getTodoDetail({ id: todo.id }, { actor });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.comments).toHaveLength(2);
      expect(res.data.comments[0]?.body).toBe('first');
      expect(res.data.comments[1]?.body).toBe('second');
    }
  });
});

// ============================================================================
// Rate-limit: 11 consecutive posts → 11th is rate_limited
// ============================================================================

describe('Rate limiting: postComment', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('11 consecutive posts within 60s — 11th returns rate_limited', async () => {
    const { postComment } = await import('@/server/actions/comments');
    const actor = await createMember();
    const todo = await seedTodo({ createdByUserId: actor.id });

    // 10 should succeed
    for (let i = 1; i <= 10; i++) {
      const res = await postComment({ todoId: todo.id, body: `comment ${i}` }, { actor });
      expect(res.ok).toBe(true);
    }

    // 11th should be rate limited
    const res11 = await postComment({ todoId: todo.id, body: 'over limit' }, { actor });
    expect(res11.ok).toBe(false);
    if (!res11.ok) {
      expect(res11.error.code).toBe('rate_limited');
    }
  });
});
