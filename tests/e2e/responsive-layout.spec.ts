/**
 * E2E responsive layout tests — Phase 8.
 * SPEC §13 E2E-7: Dashboard at 1440×900 shows 2×2 grid; at small viewport shows single column.
 *
 * Strategy (pragmatic):
 *   - The dashboard behind auth cannot be reached without a real session.
 *   - We test the sign-in page (public) for responsive correctness at all viewports.
 *   - The authenticated dashboard test is skipped with a note until Phase 9 globalSetup.
 *
 * Assertions that DO work now:
 *   - No horizontal scroll at any viewport on the sign-in page.
 *   - Sign-in page key elements visible at all viewports.
 */
import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 568, label: '320px (small mobile)' },
  { width: 768, height: 1024, label: '768px (tablet)' },
  { width: 1024, height: 768, label: '1024px (desktop sm)' },
  { width: 1440, height: 900, label: '1440px (desktop lg)' },
] as const;

// ---------------------------------------------------------------------------
// Sign-in page (public) — no OAuth needed
// ---------------------------------------------------------------------------

for (const vp of VIEWPORTS) {
  test(`sign-in page — no horizontal scroll at ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/sign-in');

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const innerWidth = await page.evaluate(() => window.innerWidth);

    // Allow 1px tolerance for rounding
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  });

  test(`sign-in page — OAuth buttons visible at ${vp.label}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/sign-in');

    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
  });
}

// ---------------------------------------------------------------------------
// Authenticated dashboard — requires session (Phase 9 globalSetup)
// ---------------------------------------------------------------------------

test.skip(
  'dashboard at 320×568 — single column, no horizontal scroll — requires auth session (Phase 9)',
  async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);

    // All four card sections should be visible (stacked)
    await expect(page.getByRole('region', { name: /active sprint/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /my todos/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /upcoming deadlines/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /team activity/i })).toBeVisible();
  },
);

test.skip(
  'dashboard at 1440×900 — 2×2 grid, no horizontal scroll — requires auth session (Phase 9)',
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  },
);
