/**
 * Typed PostHog event catalog for Phase 7.
 * Every event in PRD §8 is represented as a discriminated union member.
 *
 * To allow mocking in tests, `track()` delegates to an injectable sink.
 * Override the sink via `__setPosthogClientForTest` in test files.
 */
import { emitEvent, type PostHogSink } from './posthog';

// ============================================================================
// Event union — mirrors PRD §8 event table exactly
// ============================================================================

export type AnalyticsEvent =
  | {
      name: 'session_started';
      props: { userId: string; provider: 'google' };
    }
  | {
      name: 'sprint_created';
      props: { userId: string; sprintId: string; goalCount: number; durationDays: number };
    }
  | {
      name: 'sprint_activated';
      props: { userId: string; sprintId: string };
    }
  | {
      name: 'sprint_completed';
      props: { userId: string; sprintId: string; todoTotal: number; todoDone: number; goalCount: number };
    }
  | {
      name: 'todo_created';
      props: {
        userId: string;
        todoId: string;
        hasSprint: boolean;
        hasGoal: boolean;
        hasAssignee: boolean;
        hasDueDate: boolean;
        priority: string;
      };
    }
  | {
      name: 'todo_status_changed';
      props: { userId: string; todoId: string; from: string; to: string };
    }
  | {
      name: 'todo_assigned';
      props: { userId: string; todoId: string; assigneeUserId: string };
    }
  | {
      name: 'comment_posted';
      props: { userId: string; todoId: string; commentLengthBucket: 's' | 'm' | 'l' };
    }
  | {
      name: 'notification_opened';
      props: { userId: string; notificationId: string; kind: string };
    }
  | {
      name: 'dashboard_viewed';
      props: { userId: string };
    };

// ============================================================================
// Injectable sink (allows test overrides)
// ============================================================================

type TrackerSink = {
  emit: (userId: string, eventName: string, params: Record<string, unknown>) => Promise<void>;
};

let _sink: TrackerSink = {
  emit: emitEvent,
};

/**
 * Override the PostHog sink for tests.
 * Call with `null` to restore the default production sink.
 */
export function __setPosthogClientForTest(sink: PostHogSink | null): void {
  if (sink === null) {
    _sink = { emit: emitEvent };
  } else {
    _sink = {
      emit: async (userId, eventName, params) => {
        sink.capture({ distinctId: userId, event: eventName, properties: params });
      },
    };
  }
}

// ============================================================================
// track() — the public typed wrapper
// ============================================================================

/**
 * Emit a typed analytics event via the PostHog sink.
 * Never throws — analytics failures are non-fatal.
 */
export async function track(event: AnalyticsEvent): Promise<void> {
  const { name, props } = event;
  const { userId, ...rest } = props as { userId: string } & Record<string, unknown>;
  try {
    await _sink.emit(userId, name, rest);
  } catch {
    // Analytics failures must never surface to callers
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Returns one of 's', 'm', 'l' based on comment body length (PRD §8). */
export function commentLengthBucket(body: string): 's' | 'm' | 'l' {
  if (body.length < 140) return 's';
  if (body.length <= 500) return 'm';
  return 'l';
}
