/**
 * Unit tests for todo mapper functions.
 */
import { describe, test, expect } from 'vitest';
import { mapTodoRow, mapTodoLinkRow, mapTodoDocumentRow } from '@/server/db/todo-mappers';

const baseTodoRow = {
  id: 'todo-1',
  title: 'Test Todo',
  description: null,
  status: 'todo',
  priority: 'medium',
  assigneeUserId: null,
  dueDate: null,
  sprintId: null,
  sprintGoalId: null,
  createdByUserId: 'user-1',
  completedAt: null,
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
};

const baseLinkRow = {
  id: 'link-1',
  todoId: 'todo-1',
  url: 'https://example.com',
  label: 'Docs',
  position: 0,
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
};

const baseDocRow = {
  todoId: 'todo-1',
  contentMarkdown: '# Hello',
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedByUserId: 'user-1',
};

describe('mapTodoLinkRow', () => {
  test('maps all fields correctly', () => {
    const result = mapTodoLinkRow(baseLinkRow);
    expect(result.id).toBe('link-1');
    expect(result.todoId).toBe('todo-1');
    expect(result.url).toBe('https://example.com');
    expect(result.label).toBe('Docs');
    expect(result.position).toBe(0);
  });

  test('maps null label correctly', () => {
    const result = mapTodoLinkRow({ ...baseLinkRow, label: null });
    expect(result.label).toBeNull();
  });
});

describe('mapTodoDocumentRow', () => {
  test('maps all fields correctly', () => {
    const result = mapTodoDocumentRow(baseDocRow);
    expect(result.todoId).toBe('todo-1');
    expect(result.contentMarkdown).toBe('# Hello');
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.updatedByUserId).toBe('user-1');
  });
});

describe('mapTodoRow', () => {
  test('maps all required Todo fields', () => {
    const result = mapTodoRow(baseTodoRow, [], null);
    expect(result.id).toBe('todo-1');
    expect(result.title).toBe('Test Todo');
    expect(result.description).toBeNull();
    expect(result.status).toBe('todo');
    expect(result.priority).toBe('medium');
    expect(result.assigneeUserId).toBeNull();
    expect(result.dueDate).toBeNull();
    expect(result.sprintId).toBeNull();
    expect(result.sprintGoalId).toBeNull();
    expect(result.createdByUserId).toBe('user-1');
    expect(result.completedAt).toBeNull();
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.links).toEqual([]);
    expect(result.document).toBeNull();
  });

  test('converts dueDate Date to ISO string', () => {
    const result = mapTodoRow(
      { ...baseTodoRow, dueDate: new Date('2026-06-01T00:00:00.000Z') },
      [],
      null,
    );
    expect(result.dueDate).toBe('2026-06-01');
  });

  test('maps links when provided', () => {
    const result = mapTodoRow(baseTodoRow, [baseLinkRow], null);
    expect(result.links).toHaveLength(1);
    expect(result.links[0]?.url).toBe('https://example.com');
  });

  test('maps document when provided', () => {
    const result = mapTodoRow(baseTodoRow, [], baseDocRow);
    expect(result.document).not.toBeNull();
    expect(result.document?.contentMarkdown).toBe('# Hello');
  });

  test('returns null document when document is null', () => {
    const result = mapTodoRow(baseTodoRow, [], null);
    expect(result.document).toBeNull();
  });

  test('maps links from row.links when not passed separately', () => {
    const rowWithLinks = { ...baseTodoRow, links: [baseLinkRow], document: null };
    const result = mapTodoRow(rowWithLinks);
    expect(result.links).toHaveLength(1);
  });

  test('maps document from row.document when not passed separately', () => {
    const rowWithDoc = { ...baseTodoRow, links: [], document: baseDocRow };
    const result = mapTodoRow(rowWithDoc);
    expect(result.document?.contentMarkdown).toBe('# Hello');
  });

  test('status is cast to TodoStatus type', () => {
    const result = mapTodoRow({ ...baseTodoRow, status: 'done' }, [], null);
    expect(result.status).toBe('done');
  });

  test('priority is cast to TodoPriority type', () => {
    const result = mapTodoRow({ ...baseTodoRow, priority: 'high' }, [], null);
    expect(result.priority).toBe('high');
  });

  test('completedAt is preserved as Date', () => {
    const completedAt = new Date('2026-05-01T12:00:00.000Z');
    const result = mapTodoRow({ ...baseTodoRow, completedAt }, [], null);
    expect(result.completedAt).toEqual(completedAt);
  });
});
