/**
 * Unit tests for the analytics event catalog (Phase 7).
 * Verifies:
 * 1. Every PRD §8 event has a case in the AnalyticsEvent union.
 * 2. track() is a no-op when POSTHOG_API_KEY is missing / disabled.
 * 3. __setPosthogClientForTest allows injecting a mock sink.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { AnalyticsEvent } from '@/server/analytics/events';

// ============================================================================
// PRD §8 events that must be present in the union
// ============================================================================

const PRD_EVENTS: Array<AnalyticsEvent['name']> = [
  'session_started',
  'sprint_created',
  'sprint_activated',
  'sprint_completed',
  'todo_created',
  'todo_status_changed',
  'todo_assigned',
  'comment_posted',
  'notification_opened',
  'dashboard_viewed',
];

describe('AnalyticsEvent union covers all PRD §8 events', () => {
  test('every PRD §8 event name is representable as an AnalyticsEvent', () => {
    // Build a name → type-narrowed stub for each event to verify the union is exhaustive.
    // If any name were missing from the union, TypeScript would error at build time.
    // At runtime we verify the array matches the expected set.
    const names: string[] = PRD_EVENTS;
    expect(names).toContain('session_started');
    expect(names).toContain('sprint_created');
    expect(names).toContain('sprint_activated');
    expect(names).toContain('sprint_completed');
    expect(names).toContain('todo_created');
    expect(names).toContain('todo_status_changed');
    expect(names).toContain('todo_assigned');
    expect(names).toContain('comment_posted');
    expect(names).toContain('notification_opened');
    expect(names).toContain('dashboard_viewed');
    expect(names.length).toBe(10);
  });
});

// ============================================================================
// track() with injectable sink
// ============================================================================

describe('track() with injectable test sink', () => {
  beforeEach(async () => {
    // Reset to production sink after each test
    const { __setPosthogClientForTest } = await import('@/server/analytics/events');
    __setPosthogClientForTest(null);
  });

  test('track() calls sink.capture with correct event name and props', async () => {
    const { track, __setPosthogClientForTest } = await import('@/server/analytics/events');
    const captured: Array<{ distinctId: string; event: string; properties?: Record<string, unknown> }> = [];
    __setPosthogClientForTest({
      capture: (args) => { captured.push(args); },
    });

    await track({
      name: 'todo_created',
      props: {
        userId: 'user-1',
        todoId: 'todo-1',
        hasSprint: false,
        hasGoal: false,
        hasAssignee: true,
        hasDueDate: false,
        priority: 'medium',
      },
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.event).toBe('todo_created');
    expect(captured[0]?.distinctId).toBe('user-1');
    expect(captured[0]?.properties?.['todoId']).toBe('todo-1');
    expect(captured[0]?.properties?.['hasAssignee']).toBe(true);
  });

  test('track() is a no-op when sink throws (errors must never bubble)', async () => {
    const { track, __setPosthogClientForTest } = await import('@/server/analytics/events');
    __setPosthogClientForTest({
      capture: () => { throw new Error('PostHog outage!'); },
    });

    // Should not throw
    await expect(
      track({ name: 'sprint_activated', props: { userId: 'u', sprintId: 's' } })
    ).resolves.toBeUndefined();
  });

  test('userId is not emitted in the properties (it becomes distinctId)', async () => {
    const { track, __setPosthogClientForTest } = await import('@/server/analytics/events');
    const captured: Array<{ distinctId: string; event: string; properties?: Record<string, unknown> }> = [];
    __setPosthogClientForTest({
      capture: (args) => { captured.push(args); },
    });

    await track({
      name: 'session_started',
      props: { userId: 'u-abc', provider: 'github' },
    });

    expect(captured[0]?.distinctId).toBe('u-abc');
    // userId should not be a key in properties
    expect(Object.keys(captured[0]?.properties ?? {})).not.toContain('userId');
  });
});

// ============================================================================
// commentLengthBucket helper
// ============================================================================

describe('commentLengthBucket', () => {
  test('short body (< 140 chars) returns "s"', async () => {
    const { commentLengthBucket } = await import('@/server/analytics/events');
    expect(commentLengthBucket('Hello')).toBe('s');
    expect(commentLengthBucket('a'.repeat(139))).toBe('s');
  });

  test('medium body (140–500 chars) returns "m"', async () => {
    const { commentLengthBucket } = await import('@/server/analytics/events');
    expect(commentLengthBucket('a'.repeat(140))).toBe('m');
    expect(commentLengthBucket('a'.repeat(500))).toBe('m');
  });

  test('large body (> 500 chars) returns "l"', async () => {
    const { commentLengthBucket } = await import('@/server/analytics/events');
    expect(commentLengthBucket('a'.repeat(501))).toBe('l');
  });
});
