/**
 * Unit tests for sprint mappers — date ISO conversion.
 */
import { describe, test, expect } from 'vitest';
import { toIsoDate } from '@/lib/utils/date';
import { mapSprintRow, mapSprintGoalRow } from '@/server/db/sprint-mappers';

describe('toIsoDate', () => {
  test('converts a JS Date to ISO yyyy-mm-dd string', () => {
    const d = new Date('2026-05-01T00:00:00.000Z');
    expect(toIsoDate(d)).toBe('2026-05-01');
  });

  test('returns null for null input', () => {
    expect(toIsoDate(null)).toBeNull();
  });

  test('handles end of year correctly', () => {
    const d = new Date('2026-12-31T00:00:00.000Z');
    expect(toIsoDate(d)).toBe('2026-12-31');
  });
});

describe('mapSprintRow', () => {
  const baseRow = {
    id: 'sprint-1',
    name: 'Test Sprint',
    startDate: new Date('2026-05-01T00:00:00.000Z'),
    endDate: new Date('2026-05-14T00:00:00.000Z'),
    status: 'planned' as const,
    createdByUserId: 'user-1',
    completedAt: null,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  };

  test('maps start and end dates to ISO strings', () => {
    const result = mapSprintRow(baseRow, []);
    expect(result.startDate).toBe('2026-05-01');
    expect(result.endDate).toBe('2026-05-14');
  });

  test('maps completedAt null correctly', () => {
    const result = mapSprintRow(baseRow, []);
    expect(result.completedAt).toBeNull();
  });

  test('maps completedAt when present', () => {
    const completedAt = new Date('2026-05-20T12:00:00.000Z');
    const result = mapSprintRow({ ...baseRow, status: 'completed' as const, completedAt }, []);
    expect(result.completedAt).toEqual(completedAt);
  });

  test('includes goals in the mapped sprint', () => {
    const goals = [
      {
        id: 'goal-1',
        sprintId: 'sprint-1',
        name: 'Goal A',
        position: 0,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ];
    const result = mapSprintRow(baseRow, goals);
    expect(result.goals).toHaveLength(1);
    expect(result.goals[0]?.name).toBe('Goal A');
  });

  test('maps all required Sprint fields', () => {
    const result = mapSprintRow(baseRow, []);
    expect(result.id).toBe('sprint-1');
    expect(result.name).toBe('Test Sprint');
    expect(result.status).toBe('planned');
    expect(result.createdByUserId).toBe('user-1');
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});

describe('mapSprintGoalRow', () => {
  test('maps a sprint goal row to domain SprintGoal', () => {
    const row = {
      id: 'goal-1',
      sprintId: 'sprint-1',
      name: 'My Goal',
      position: 1,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    };
    const result = mapSprintGoalRow(row);
    expect(result.id).toBe('goal-1');
    expect(result.sprintId).toBe('sprint-1');
    expect(result.name).toBe('My Goal');
    expect(result.position).toBe(1);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});
