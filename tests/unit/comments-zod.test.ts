/**
 * Unit tests for comment Zod schemas — body length bounds.
 */
import { describe, test, expect } from 'vitest';
import {
  postCommentSchema,
  editCommentSchema,
  deleteCommentSchema,
  listCommentsSchema,
} from '@/lib/zod/comments';

const VALID_UUID = '00000000-0000-0000-0000-000000000001';

// ============================================================================
// postCommentSchema
// ============================================================================

describe('postCommentSchema', () => {
  test('valid input passes', () => {
    const result = postCommentSchema.safeParse({ todoId: VALID_UUID, body: 'Hello!' });
    expect(result.success).toBe(true);
  });

  test('body of exactly 2000 chars passes', () => {
    const result = postCommentSchema.safeParse({ todoId: VALID_UUID, body: 'a'.repeat(2000) });
    expect(result.success).toBe(true);
  });

  test('body of 2001 chars is rejected', () => {
    const result = postCommentSchema.safeParse({ todoId: VALID_UUID, body: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.path).toContain('body');
    }
  });

  test('empty body is rejected', () => {
    const result = postCommentSchema.safeParse({ todoId: VALID_UUID, body: '' });
    expect(result.success).toBe(false);
  });

  test('missing todoId is rejected', () => {
    const result = postCommentSchema.safeParse({ body: 'hello' });
    expect(result.success).toBe(false);
  });

  test('non-UUID todoId is rejected', () => {
    const result = postCommentSchema.safeParse({ todoId: 'not-a-uuid', body: 'hello' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// editCommentSchema
// ============================================================================

describe('editCommentSchema', () => {
  test('valid input passes', () => {
    const result = editCommentSchema.safeParse({ id: VALID_UUID, body: 'updated' });
    expect(result.success).toBe(true);
  });

  test('body exactly 2000 chars passes', () => {
    const result = editCommentSchema.safeParse({ id: VALID_UUID, body: 'b'.repeat(2000) });
    expect(result.success).toBe(true);
  });

  test('body 2001 chars rejected', () => {
    const result = editCommentSchema.safeParse({ id: VALID_UUID, body: 'b'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  test('empty body rejected', () => {
    const result = editCommentSchema.safeParse({ id: VALID_UUID, body: '' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// deleteCommentSchema
// ============================================================================

describe('deleteCommentSchema', () => {
  test('valid UUID passes', () => {
    const result = deleteCommentSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  test('non-UUID id is rejected', () => {
    const result = deleteCommentSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// listCommentsSchema
// ============================================================================

describe('listCommentsSchema', () => {
  test('valid UUID todoId passes', () => {
    const result = listCommentsSchema.safeParse({ todoId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  test('non-UUID todoId is rejected', () => {
    const result = listCommentsSchema.safeParse({ todoId: 'not-valid' });
    expect(result.success).toBe(false);
  });
});
