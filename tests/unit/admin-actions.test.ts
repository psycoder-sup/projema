/**
 * Unit tests for admin action Zod validation.
 * Tests input schema validation without hitting the database.
 */
import { describe, test, expect } from 'vitest';
import {
  addAllowlistEmailSchema,
  removeAllowlistEmailSchema,
  deactivateUserSchema,
} from '@/lib/zod/admin';

describe('addAllowlistEmailSchema', () => {
  test('accepts valid email', () => {
    const result = addAllowlistEmailSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  test('lowercases email', () => {
    const result = addAllowlistEmailSchema.safeParse({ email: 'TEST@EXAMPLE.COM' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  test('rejects invalid email', () => {
    const result = addAllowlistEmailSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  test('rejects empty string', () => {
    const result = addAllowlistEmailSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing email field', () => {
    const result = addAllowlistEmailSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('removeAllowlistEmailSchema', () => {
  test('accepts valid entryId', () => {
    const result = removeAllowlistEmailSchema.safeParse({ entryId: 'cuid123' });
    expect(result.success).toBe(true);
  });

  test('rejects empty entryId', () => {
    const result = removeAllowlistEmailSchema.safeParse({ entryId: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing entryId', () => {
    const result = removeAllowlistEmailSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('deactivateUserSchema', () => {
  test('accepts valid userId', () => {
    const result = deactivateUserSchema.safeParse({ userId: 'user123' });
    expect(result.success).toBe(true);
  });

  test('rejects empty userId', () => {
    const result = deactivateUserSchema.safeParse({ userId: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing userId', () => {
    const result = deactivateUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
