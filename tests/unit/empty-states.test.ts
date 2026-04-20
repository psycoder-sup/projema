/**
 * Unit tests for Phase 8: empty-state copy verification.
 * Asserts that each component/page contains the exact PRD-specified copy.
 * This is a static source-code check — fast, no DOM, no DB.
 */
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';

function readSrc(relativePath: string): string {
  return fs.readFileSync(relativePath, 'utf-8');
}

describe('Empty-state copy — PRD §6 source of truth', () => {
  // PRD: "No active sprint — plan one to start tracking goals" with "Create sprint" CTA
  test('ActiveSprintCard — correct empty-state copy', () => {
    const src = readSrc('src/components/dashboard/ActiveSprintCard.tsx');
    // The PRD copy uses "No active sprint" as the opening phrase
    expect(src).toMatch(/No active sprint/i);
    // Must have a Create sprint CTA
    expect(src).toMatch(/Create sprint/i);
  });

  // PRD: "Nothing on your plate. Pick up a todo from the sprint board or create one."
  test('MyTodosCard — correct empty-state copy', () => {
    const src = readSrc('src/components/dashboard/MyTodosCard.tsx');
    expect(src).toMatch(/Nothing on your plate/i);
  });

  // PRD: "No todos due in the next 7 days."
  test('UpcomingDeadlinesCard — correct empty-state copy', () => {
    const src = readSrc('src/components/dashboard/UpcomingDeadlinesCard.tsx');
    expect(src).toMatch(/No todos due in the next 7 days/i);
  });

  // PRD: "Activity will appear here as your team uses the app."
  test('TeamActivityCard — correct empty-state copy', () => {
    const src = readSrc('src/components/dashboard/TeamActivityCard.tsx');
    expect(src).toMatch(/Activity will appear here as your team uses the app/i);
  });

  // PRD: "No sprints yet. Plan your first sprint."
  test('Sprints page — correct empty-state copy', () => {
    const src = readSrc('src/app/(app)/sprints/page.tsx');
    expect(src).toMatch(/No sprints yet/i);
    expect(src).toMatch(/Plan your first sprint/i);
  });

  // PRD: "No backlog todos. Use Backlog to park work that isn't in a sprint yet."
  test('Backlog page — correct empty-state copy', () => {
    const src = readSrc('src/app/(app)/todos/page.tsx');
    expect(src).toMatch(/No backlog todos/i);
  });

  // PRD: "Nothing on your plate…"
  test('My Todos page — correct empty-state copy', () => {
    const src = readSrc('src/app/(app)/todos/mine/page.tsx');
    expect(src).toMatch(/Nothing on your plate/i);
  });

  // PRD: "No allowlist entries yet."
  test('Admin members page — allowlist empty state', () => {
    const src = readSrc('src/app/(app)/admin/members/page.tsx');
    expect(src).toMatch(/No (allowlist entries yet|emails in allowlist)/i);
  });

  // PRD: "You're all caught up."
  // DenseBellMenu uses JSX &apos; entity for the apostrophe, so match either form.
  test('DenseBellMenu — notifications empty-state copy', () => {
    const src = readSrc('src/components/layout/dense/DenseBellMenu.tsx');
    expect(src).toMatch(/You(&apos;|'|&#39;)re all caught up/i);
  });
});
