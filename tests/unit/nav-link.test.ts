import { describe, expect, it } from 'vitest';
import { bestNavMatch } from '@/components/layout/nav-active';

describe('bestNavMatch', () => {
  const items = [
    '/dashboard',
    '/todos/mine',
    '/sprints',
    '/todos',
    '/admin/members',
  ] as const;

  it('picks the most-specific match on detail routes', () => {
    expect(bestNavMatch('/todos/abc123', items)).toBe('/todos');
    expect(bestNavMatch('/todos/mine', items)).toBe('/todos/mine');
    expect(bestNavMatch('/todos/mine/filter', items)).toBe('/todos/mine');
    expect(bestNavMatch('/sprints/xyz', items)).toBe('/sprints');
    expect(bestNavMatch('/admin/members/42', items)).toBe('/admin/members');
  });

  it('prefers /todos/mine over /todos on /todos/mine (longest prefix wins)', () => {
    expect(bestNavMatch('/todos/mine', items)).toBe('/todos/mine');
  });

  it('returns null when nothing matches', () => {
    expect(bestNavMatch('/settings', items)).toBeNull();
  });

  it('does not false-positive on shared string prefixes', () => {
    expect(bestNavMatch('/sprintsimilar', items)).toBeNull();
    expect(bestNavMatch('/todosmine', items)).toBeNull();
  });
});
