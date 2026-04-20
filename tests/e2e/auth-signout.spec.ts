/**
 * E2E tests for FR-04: sign-out is visible on every authenticated route.
 *
 * Phase 8 implementation strategy:
 *   Full OAuth mocking requires a Playwright globalSetup that seeds a Prisma DB user
 *   and injects Auth.js session cookies. That infrastructure is tracked for Phase 9.
 *
 *   What we CAN test against the running app without OAuth:
 *   - The sign-in page renders the expected sign-in buttons (no email/password form).
 *   - The app correctly redirects unauthenticated requests to /sign-in.
 *   - The /sign-in page has no sign-out element (it's a public page).
 *
 *   The full authenticated sign-out assertion is marked test.skip with a clear note.
 */
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Unauthenticated redirect (verifiable without OAuth)
// ---------------------------------------------------------------------------

test('unauthenticated request to /dashboard redirects to /sign-in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('unauthenticated request to /sprints redirects to /sign-in', async ({ page }) => {
  await page.goto('/sprints');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('unauthenticated request to /todos redirects to /sign-in', async ({ page }) => {
  await page.goto('/todos');
  await expect(page).toHaveURL(/\/sign-in/);
});

// ---------------------------------------------------------------------------
// Sign-in page (public — no OAuth needed)
// ---------------------------------------------------------------------------

test('sign-in page renders the Google button', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
});

test('sign-in page has no email/password form (FR-01)', async ({ page }) => {
  await page.goto('/sign-in');
  // There must be no password input — auth is OAuth-only
  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Authenticated sign-out (requires mocked OAuth session cookie)
// ---------------------------------------------------------------------------

test.skip(
  'FR-04: sign-out menu visible on authenticated pages — requires Playwright globalSetup with DB seed + session cookie injection (Phase 9)',
  async ({ page }) => {
    // Implementation outline (Phase 9):
    // 1. In playwright.config.ts globalSetup: seed a user via Prisma, create an
    //    Auth.js `sessions` row, store the session token.
    // 2. In the test: call page.context().addCookies([{ name: 'authjs.session-token', value: token, ... }])
    // 3. Navigate to /dashboard — should land without redirect.
    // 4. Click the "Account menu" trigger in the sidebar me-card.
    // 5. Assert getByRole('menuitem', { name: /sign out/i }) is visible.
    // 6. Click Sign out → assert redirect to /sign-in.
    //
    // The markup is now wired — `DenseAccountMenu` renders a button with
    // aria-label="Account menu" and a Radix menuitem "Sign out". This block
    // stays skipped only because the cookie-injection harness doesn't exist
    // yet, not because the UI is missing.
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /account menu/i }).click();
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  },
);
