/**
 * Unit tests for sprint Zod schemas.
 * FR-05, FR-06 boundary cases.
 */
import { describe, test, expect } from 'vitest';
import {
  sprintStatusSchema,
  createSprintSchema,
  updateSprintSchema,
  activateSprintSchema,
  completeSprintSchema,
  deleteSprintSchema,
  deleteSprintGoalSchema,
  listSprintsInputSchema,
  getSprintDetailSchema,
} from '@/lib/zod/sprints';

// ============================================================================
// FR-06: sprintStatusSchema
// ============================================================================

describe('sprintStatusSchema', () => {
  test('accepts planned', () => {
    expect(sprintStatusSchema.safeParse('planned').success).toBe(true);
  });
  test('accepts active', () => {
    expect(sprintStatusSchema.safeParse('active').success).toBe(true);
  });
  test('accepts completed', () => {
    expect(sprintStatusSchema.safeParse('completed').success).toBe(true);
  });
  test('rejects archived', () => {
    expect(sprintStatusSchema.safeParse('archived').success).toBe(false);
  });
  test('rejects empty string', () => {
    expect(sprintStatusSchema.safeParse('').success).toBe(false);
  });
  test('rejects null', () => {
    expect(sprintStatusSchema.safeParse(null).success).toBe(false);
  });
});

// ============================================================================
// FR-05: createSprintSchema boundary cases
// ============================================================================

describe('createSprintSchema', () => {
  const valid = {
    name: 'My Sprint',
    startDate: '2026-05-01',
    endDate: '2026-05-14',
    goals: ['Goal A', 'Goal B'],
  };

  test('valid input passes', () => {
    expect(createSprintSchema.safeParse(valid).success).toBe(true);
  });

  test('name too long (141 chars) rejected', () => {
    const r = createSprintSchema.safeParse({ ...valid, name: 'x'.repeat(141) });
    expect(r.success).toBe(false);
  });

  test('name at exactly 140 chars is accepted', () => {
    const r = createSprintSchema.safeParse({ ...valid, name: 'x'.repeat(140) });
    expect(r.success).toBe(true);
  });

  test('empty name rejected', () => {
    const r = createSprintSchema.safeParse({ ...valid, name: '' });
    expect(r.success).toBe(false);
  });

  test('endDate before startDate rejected with path [endDate]', () => {
    const r = createSprintSchema.safeParse({
      ...valid,
      startDate: '2026-05-10',
      endDate: '2026-05-01',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const endDateError = r.error.errors.find((e) => e.path[0] === 'endDate');
      expect(endDateError).toBeDefined();
    }
  });

  test('endDate equal to startDate is accepted', () => {
    const r = createSprintSchema.safeParse({
      ...valid,
      startDate: '2026-05-01',
      endDate: '2026-05-01',
    });
    expect(r.success).toBe(true);
  });

  test('duplicate goal names (case-insensitive) rejected', () => {
    const r = createSprintSchema.safeParse({ ...valid, goals: ['Alpha', 'alpha'] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.errors.some((e) => e.code === 'custom')).toBe(true);
    }
  });

  test('unique goal names pass', () => {
    const r = createSprintSchema.safeParse({ ...valid, goals: ['Alpha', 'Beta'] });
    expect(r.success).toBe(true);
  });

  test('goal name over 140 chars rejected', () => {
    const r = createSprintSchema.safeParse({ ...valid, goals: ['x'.repeat(141)] });
    expect(r.success).toBe(false);
  });

  test('empty goals array is allowed', () => {
    const r = createSprintSchema.safeParse({ ...valid, goals: [] });
    expect(r.success).toBe(true);
  });

  test('missing name rejected', () => {
    const { name: _n, ...rest } = valid;
    const r = createSprintSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});

// ============================================================================
// updateSprintSchema
// ============================================================================

describe('updateSprintSchema', () => {
  test('valid with id only', () => {
    const r = updateSprintSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(r.success).toBe(true);
  });

  test('valid with all optional fields', () => {
    const r = updateSprintSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated',
      startDate: '2026-05-01',
      endDate: '2026-05-14',
      goalsUpsert: [{ name: 'New Goal' }, { id: 'some-id', name: 'Existing Goal' }],
    });
    expect(r.success).toBe(true);
  });

  test('missing id rejected', () => {
    const r = updateSprintSchema.safeParse({ name: 'Updated' });
    expect(r.success).toBe(false);
  });
});

// ============================================================================
// activateSprintSchema
// ============================================================================

describe('activateSprintSchema', () => {
  test('valid with id only', () => {
    const r = activateSprintSchema.safeParse({ id: 'some-id' });
    expect(r.success).toBe(true);
  });

  test('valid with acknowledgedCompletingId', () => {
    const r = activateSprintSchema.safeParse({
      id: 'some-id',
      acknowledgedCompletingId: 'other-id',
    });
    expect(r.success).toBe(true);
  });

  test('missing id rejected', () => {
    const r = activateSprintSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

// ============================================================================
// completeSprintSchema
// ============================================================================

describe('completeSprintSchema', () => {
  test('valid', () => {
    expect(completeSprintSchema.safeParse({ id: 'some-id' }).success).toBe(true);
  });

  test('missing id rejected', () => {
    expect(completeSprintSchema.safeParse({}).success).toBe(false);
  });
});

// ============================================================================
// deleteSprintSchema
// ============================================================================

describe('deleteSprintSchema', () => {
  test('valid', () => {
    expect(deleteSprintSchema.safeParse({ id: 'some-id' }).success).toBe(true);
  });
});

// ============================================================================
// deleteSprintGoalSchema
// ============================================================================

describe('deleteSprintGoalSchema', () => {
  test('valid with detach_todos strategy', () => {
    const r = deleteSprintGoalSchema.safeParse({ goalId: 'g1', strategy: 'detach_todos' });
    expect(r.success).toBe(true);
  });

  test('valid with cancel strategy', () => {
    const r = deleteSprintGoalSchema.safeParse({ goalId: 'g1', strategy: 'cancel' });
    expect(r.success).toBe(true);
  });

  test('invalid strategy rejected', () => {
    const r = deleteSprintGoalSchema.safeParse({ goalId: 'g1', strategy: 'something_else' });
    expect(r.success).toBe(false);
  });

  test('missing goalId rejected', () => {
    const r = deleteSprintGoalSchema.safeParse({ strategy: 'cancel' });
    expect(r.success).toBe(false);
  });
});

// ============================================================================
// listSprintsInputSchema
// ============================================================================

describe('listSprintsInputSchema', () => {
  test('empty object is valid', () => {
    expect(listSprintsInputSchema.safeParse({}).success).toBe(true);
  });

  test('valid with status filter', () => {
    expect(listSprintsInputSchema.safeParse({ status: 'planned' }).success).toBe(true);
  });

  test('invalid status rejected', () => {
    expect(listSprintsInputSchema.safeParse({ status: 'invalid' }).success).toBe(false);
  });
});

// ============================================================================
// getSprintDetailSchema
// ============================================================================

describe('getSprintDetailSchema', () => {
  test('valid with id', () => {
    expect(getSprintDetailSchema.safeParse({ id: 'some-id' }).success).toBe(true);
  });

  test('missing id rejected', () => {
    expect(getSprintDetailSchema.safeParse({}).success).toBe(false);
  });
});
