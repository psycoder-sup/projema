import { describe, expect, it } from 'vitest';
import { isNavLinkActive } from '@/components/layout/nav-active';

describe('isNavLinkActive', () => {
  describe('exact matching', () => {
    it('activates /dashboard only on /dashboard', () => {
      expect(isNavLinkActive('/dashboard', '/dashboard', true)).toBe(true);
      expect(isNavLinkActive('/dashboard/anything', '/dashboard', true)).toBe(false);
      expect(isNavLinkActive('/', '/dashboard', true)).toBe(false);
    });

    it('activates /todos exactly and NOT on /todos/mine or /todos/abc', () => {
      expect(isNavLinkActive('/todos', '/todos', true)).toBe(true);
      expect(isNavLinkActive('/todos/mine', '/todos', true)).toBe(false);
      expect(isNavLinkActive('/todos/abc123', '/todos', true)).toBe(false);
    });
  });

  describe('prefix matching', () => {
    it('activates /todos/mine on itself and nested routes, not on /todos', () => {
      expect(isNavLinkActive('/todos/mine', '/todos/mine')).toBe(true);
      expect(isNavLinkActive('/todos/mine/filter', '/todos/mine')).toBe(true);
      expect(isNavLinkActive('/todos', '/todos/mine')).toBe(false);
    });

    it('activates /sprints on itself and detail routes', () => {
      expect(isNavLinkActive('/sprints', '/sprints')).toBe(true);
      expect(isNavLinkActive('/sprints/abc123', '/sprints')).toBe(true);
      expect(isNavLinkActive('/sprints/abc/edit', '/sprints')).toBe(true);
    });

    it('does NOT match sibling paths that merely share a prefix string', () => {
      expect(isNavLinkActive('/sprintsimilar', '/sprints')).toBe(false);
      expect(isNavLinkActive('/todosmine', '/todos')).toBe(false);
    });
  });
});
