/**
 * Unit tests for Notification Zod schemas — Phase 6.
 */
import { describe, test, expect } from 'vitest';
import {
  markNotificationReadSchema,
  markAllNotificationsReadSchema,
  listNotificationsSchema,
} from '@/lib/zod/notifications';

describe('listNotificationsSchema', () => {
  test('accepts empty object', () => {
    const result = listNotificationsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('accepts object with extra keys (stripped)', () => {
    const result = listNotificationsSchema.safeParse({ extra: 'ignored' });
    expect(result.success).toBe(true);
  });
});

describe('markNotificationReadSchema', () => {
  test('accepts a valid UUID', () => {
    const result = markNotificationReadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  test('rejects non-UUID string', () => {
    const result = markNotificationReadSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
    expect(result.error?.errors[0]?.message).toContain('UUID');
  });

  test('rejects missing id', () => {
    const result = markNotificationReadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('markAllNotificationsReadSchema', () => {
  test('accepts a valid ISO datetime string', () => {
    const result = markAllNotificationsReadSchema.safeParse({
      upToCreatedAt: '2026-04-17T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('rejects ISO date without time (date-only is not a datetime)', () => {
    // Zod z.string().datetime() requires a full datetime with time component
    const result = markAllNotificationsReadSchema.safeParse({
      upToCreatedAt: '2026-04-17',
    });
    expect(result.success).toBe(false);
  });

  test('rejects non-datetime string', () => {
    const result = markAllNotificationsReadSchema.safeParse({
      upToCreatedAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  test('rejects missing upToCreatedAt', () => {
    const result = markAllNotificationsReadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
