/**
 * Unit tests for Phase 8: accessibility source-code audit.
 * Verifies that key a11y attributes are present in the source.
 * These are static code checks — fast, no browser required.
 */
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';

function readSrc(relativePath: string): string {
  return fs.readFileSync(relativePath, 'utf-8');
}

describe('Accessibility audit — static source checks', () => {
  // Bell menu: icon-only button must have aria-label
  test('BellMenu — Bell button has aria-label', () => {
    const src = readSrc('src/components/layout/BellMenu.tsx');
    expect(src).toMatch(/aria-label/);
  });

  // App layout: user avatar button must have aria-label
  test('AppLayout — user avatar button has aria-label', () => {
    const src = readSrc('src/app/(app)/layout.tsx');
    expect(src).toMatch(/aria-label/);
  });

  // App layout: nav must have aria-label="Main navigation"
  test('AppLayout — nav has aria-label="Main navigation"', () => {
    const src = readSrc('src/app/(app)/layout.tsx');
    expect(src).toMatch(/aria-label="Main navigation"/i);
  });

  // App layout: has a skip-link to main content
  test('AppLayout — has skip-link to #main-content', () => {
    const src = readSrc('src/app/(app)/layout.tsx');
    expect(src).toMatch(/skip.*main|skip-link|href="#main/i);
  });

  // Dashboard cards: each section wrapped in region with aria-label
  test('ActiveSprintCard — has aria-label region', () => {
    const src = readSrc('src/components/dashboard/ActiveSprintCard.tsx');
    expect(src).toMatch(/aria-label/);
  });

  test('MyTodosCard — has aria-label region', () => {
    const src = readSrc('src/components/dashboard/MyTodosCard.tsx');
    expect(src).toMatch(/aria-label/);
  });

  test('UpcomingDeadlinesCard — has aria-label region', () => {
    const src = readSrc('src/components/dashboard/UpcomingDeadlinesCard.tsx');
    expect(src).toMatch(/aria-label/);
  });

  test('TeamActivityCard — has aria-label region', () => {
    const src = readSrc('src/components/dashboard/TeamActivityCard.tsx');
    expect(src).toMatch(/aria-label/);
  });

  // App layout: main element has id="main-content"
  test('AppLayout — main element has id for skip-link target', () => {
    const src = readSrc('src/app/(app)/layout.tsx');
    expect(src).toMatch(/id="main-content"/);
  });
});
