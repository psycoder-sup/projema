/**
 * Unit tests for todo Zod schemas.
 * FR-11 boundary cases (Zod layer only — no DB).
 */
import { describe, test, expect } from 'vitest';
import {
  todoStatusSchema,
  todoPrioritySchema,
  todoLinkInputSchema,
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

// ============================================================================
// todoStatusSchema
// ============================================================================

describe('todoStatusSchema', () => {
  test('accepts todo', () => expect(todoStatusSchema.safeParse('todo').success).toBe(true));
  test('accepts in_progress', () => expect(todoStatusSchema.safeParse('in_progress').success).toBe(true));
  test('accepts done', () => expect(todoStatusSchema.safeParse('done').success).toBe(true));
  test('rejects pending', () => expect(todoStatusSchema.safeParse('pending').success).toBe(false));
  test('rejects empty', () => expect(todoStatusSchema.safeParse('').success).toBe(false));
});

// ============================================================================
// todoPrioritySchema
// ============================================================================

describe('todoPrioritySchema', () => {
  test('accepts low', () => expect(todoPrioritySchema.safeParse('low').success).toBe(true));
  test('accepts medium', () => expect(todoPrioritySchema.safeParse('medium').success).toBe(true));
  test('accepts high', () => expect(todoPrioritySchema.safeParse('high').success).toBe(true));
  test('rejects critical', () => expect(todoPrioritySchema.safeParse('critical').success).toBe(false));
});

// ============================================================================
// todoLinkInputSchema
// ============================================================================

describe('todoLinkInputSchema', () => {
  test('accepts https URL', () => {
    expect(todoLinkInputSchema.safeParse({ url: 'https://example.com' }).success).toBe(true);
  });

  test('accepts http URL', () => {
    expect(todoLinkInputSchema.safeParse({ url: 'http://intranet.local' }).success).toBe(true);
  });

  test('accepts mailto URL', () => {
    expect(todoLinkInputSchema.safeParse({ url: 'mailto:a@b.com' }).success).toBe(true);
  });

  test('rejects javascript: URL', () => {
    expect(todoLinkInputSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
  });

  test('rejects data: URL', () => {
    expect(todoLinkInputSchema.safeParse({ url: 'data:text/html,<script>' }).success).toBe(false);
  });

  test('rejects file:// URL', () => {
    expect(todoLinkInputSchema.safeParse({ url: 'file:///etc/passwd' }).success).toBe(false);
  });

  test('rejects URL over 2048 chars', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2048);
    expect(todoLinkInputSchema.safeParse({ url: longUrl }).success).toBe(false);
  });

  test('accepts optional label', () => {
    expect(todoLinkInputSchema.safeParse({ url: 'https://x.com', label: 'Docs' }).success).toBe(true);
  });

  test('rejects label over 140 chars', () => {
    expect(
      todoLinkInputSchema.safeParse({ url: 'https://x.com', label: 'l'.repeat(141) }).success,
    ).toBe(false);
  });
});

// ============================================================================
// createTodoSchema
// ============================================================================

describe('createTodoSchema', () => {
  const valid = { title: 'My Todo' };

  test('valid minimal input passes', () => {
    expect(createTodoSchema.safeParse(valid).success).toBe(true);
  });

  test('title over 140 chars rejected', () => {
    expect(createTodoSchema.safeParse({ title: 'x'.repeat(141) }).success).toBe(false);
  });

  test('title at 140 chars accepted', () => {
    expect(createTodoSchema.safeParse({ title: 'x'.repeat(140) }).success).toBe(true);
  });

  test('empty title rejected', () => {
    expect(createTodoSchema.safeParse({ title: '' }).success).toBe(false);
  });

  test('description over 4000 chars rejected', () => {
    expect(createTodoSchema.safeParse({ ...valid, description: 'x'.repeat(4001) }).success).toBe(false);
  });

  test('description at 4000 chars accepted', () => {
    expect(createTodoSchema.safeParse({ ...valid, description: 'x'.repeat(4000) }).success).toBe(true);
  });

  test('invalid status rejected', () => {
    expect(createTodoSchema.safeParse({ ...valid, status: 'archived' }).success).toBe(false);
  });

  test('valid status accepted', () => {
    expect(createTodoSchema.safeParse({ ...valid, status: 'in_progress' }).success).toBe(true);
  });

  test('invalid priority rejected', () => {
    expect(createTodoSchema.safeParse({ ...valid, priority: 'urgent' }).success).toBe(false);
  });

  test('invalid assigneeUserId (not UUID) rejected', () => {
    expect(createTodoSchema.safeParse({ ...valid, assigneeUserId: 'not-a-uuid' }).success).toBe(false);
  });

  test('valid UUID assigneeUserId accepted', () => {
    expect(
      createTodoSchema.safeParse({ ...valid, assigneeUserId: '00000000-0000-0000-0000-000000000001' }).success,
    ).toBe(true);
  });

  test('null assigneeUserId accepted', () => {
    expect(createTodoSchema.safeParse({ ...valid, assigneeUserId: null }).success).toBe(true);
  });

  test('valid links array accepted', () => {
    expect(
      createTodoSchema.safeParse({ ...valid, links: [{ url: 'https://x.com', label: 'X' }] }).success,
    ).toBe(true);
  });

  test('invalid link URL rejected', () => {
    expect(
      createTodoSchema.safeParse({ ...valid, links: [{ url: 'javascript:bad' }] }).success,
    ).toBe(false);
  });
});

// ============================================================================
// updateTodoSchema
// ============================================================================

describe('updateTodoSchema', () => {
  const validId = '00000000-0000-0000-0000-000000000001';

  test('valid with id only', () => {
    expect(updateTodoSchema.safeParse({ id: validId }).success).toBe(true);
  });

  test('missing id rejected', () => {
    expect(updateTodoSchema.safeParse({}).success).toBe(false);
  });

  test('invalid id (not UUID) rejected', () => {
    expect(updateTodoSchema.safeParse({ id: 'not-uuid' }).success).toBe(false);
  });

  test('nullable fields accept null', () => {
    const r = updateTodoSchema.safeParse({
      id: validId,
      assigneeUserId: null,
      dueDate: null,
      sprintId: null,
      sprintGoalId: null,
      description: null,
    });
    expect(r.success).toBe(true);
  });

  test('nullable fields accept values', () => {
    const r = updateTodoSchema.safeParse({
      id: validId,
      assigneeUserId: '00000000-0000-0000-0000-000000000002',
      dueDate: '2026-06-01',
      sprintId: '00000000-0000-0000-0000-000000000003',
    });
    expect(r.success).toBe(true);
  });

  test('valid expectedUpdatedAt accepted', () => {
    const r = updateTodoSchema.safeParse({
      id: validId,
      expectedUpdatedAt: '2026-04-17T10:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});

// ============================================================================
// deleteTodoSchema
// ============================================================================

describe('deleteTodoSchema', () => {
  test('valid UUID accepted', () => {
    expect(deleteTodoSchema.safeParse({ id: '00000000-0000-0000-0000-000000000001' }).success).toBe(true);
  });

  test('missing id rejected', () => {
    expect(deleteTodoSchema.safeParse({}).success).toBe(false);
  });

  test('non-UUID id rejected', () => {
    expect(deleteTodoSchema.safeParse({ id: 'not-uuid' }).success).toBe(false);
  });
});

// ============================================================================
// listTodosInputSchema
// ============================================================================

describe('listTodosInputSchema', () => {
  test('empty object valid', () => {
    expect(listTodosInputSchema.safeParse({}).success).toBe(true);
  });

  test('empty filter valid', () => {
    expect(listTodosInputSchema.safeParse({ filter: {} }).success).toBe(true);
  });

  test('backlog sprintScope valid', () => {
    expect(
      listTodosInputSchema.safeParse({ filter: { sprintScope: { kind: 'backlog' } } }).success,
    ).toBe(true);
  });

  test('any sprintScope valid', () => {
    expect(
      listTodosInputSchema.safeParse({ filter: { sprintScope: { kind: 'any' } } }).success,
    ).toBe(true);
  });

  test('sprint sprintScope with sprintId valid', () => {
    expect(
      listTodosInputSchema.safeParse({
        filter: { sprintScope: { kind: 'sprint', sprintId: '00000000-0000-0000-0000-000000000001' } },
      }).success,
    ).toBe(true);
  });

  test('sprint sprintScope without sprintId rejected', () => {
    expect(
      listTodosInputSchema.safeParse({ filter: { sprintScope: { kind: 'sprint' } } }).success,
    ).toBe(false);
  });

  test('invalid status rejected', () => {
    expect(
      listTodosInputSchema.safeParse({ filter: { status: 'archived' } }).success,
    ).toBe(false);
  });
});

// ============================================================================
// getTodoDetailSchema
// ============================================================================

describe('getTodoDetailSchema', () => {
  test('valid UUID accepted', () => {
    expect(getTodoDetailSchema.safeParse({ id: '00000000-0000-0000-0000-000000000001' }).success).toBe(true);
  });

  test('missing id rejected', () => {
    expect(getTodoDetailSchema.safeParse({}).success).toBe(false);
  });
});

// ============================================================================
// addTodoLinkSchema
// ============================================================================

describe('addTodoLinkSchema', () => {
  const todoId = '00000000-0000-0000-0000-000000000001';

  test('valid https link accepted', () => {
    expect(addTodoLinkSchema.safeParse({ todoId, url: 'https://x.com' }).success).toBe(true);
  });

  test('javascript: URL rejected', () => {
    expect(addTodoLinkSchema.safeParse({ todoId, url: 'javascript:x' }).success).toBe(false);
  });

  test('missing todoId rejected', () => {
    expect(addTodoLinkSchema.safeParse({ url: 'https://x.com' }).success).toBe(false);
  });
});

// ============================================================================
// removeTodoLinkSchema
// ============================================================================

describe('removeTodoLinkSchema', () => {
  test('valid UUID accepted', () => {
    expect(removeTodoLinkSchema.safeParse({ linkId: '00000000-0000-0000-0000-000000000001' }).success).toBe(true);
  });

  test('missing linkId rejected', () => {
    expect(removeTodoLinkSchema.safeParse({}).success).toBe(false);
  });
});

// ============================================================================
// saveTodoDocumentSchema
// ============================================================================

describe('saveTodoDocumentSchema', () => {
  const todoId = '00000000-0000-0000-0000-000000000001';

  test('valid small doc accepted', () => {
    expect(
      saveTodoDocumentSchema.safeParse({ todoId, contentMarkdown: '# hello' }).success,
    ).toBe(true);
  });

  test('doc exactly 100KB accepted', () => {
    const content = 'a'.repeat(100 * 1024);
    expect(saveTodoDocumentSchema.safeParse({ todoId, contentMarkdown: content }).success).toBe(true);
  });

  test('doc over 100KB rejected with document_too_large message', () => {
    const content = 'a'.repeat(100 * 1024 + 1);
    const r = saveTodoDocumentSchema.safeParse({ todoId, contentMarkdown: content });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.errors.some((e) => e.message === 'document_too_large')).toBe(true);
    }
  });

  test('missing todoId rejected', () => {
    expect(saveTodoDocumentSchema.safeParse({ contentMarkdown: '# hi' }).success).toBe(false);
  });

  test('valid expectedUpdatedAt accepted', () => {
    expect(
      saveTodoDocumentSchema.safeParse({
        todoId,
        contentMarkdown: 'hi',
        expectedUpdatedAt: '2026-04-17T10:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});

// ============================================================================
// deleteTodoDocumentSchema
// ============================================================================

describe('deleteTodoDocumentSchema', () => {
  test('valid UUID accepted', () => {
    expect(deleteTodoDocumentSchema.safeParse({ todoId: '00000000-0000-0000-0000-000000000001' }).success).toBe(true);
  });

  test('missing todoId rejected', () => {
    expect(deleteTodoDocumentSchema.safeParse({}).success).toBe(false);
  });
});
