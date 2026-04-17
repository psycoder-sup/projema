/**
 * E2E empty-state tests — Phase 8.
 * Asserts the PRD empty-state copy renders correctly.
 *
 * Strategy:
 *   - Sign-in page empty state (accessible without auth) is tested directly.
 *   - Authenticated page empty states require a seeded DB session (Phase 9 globalSetup).
 *   - Tests that need auth are marked test.skip with implementation notes.
 */
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Sign-in error/empty state (accessible without auth)
// ---------------------------------------------------------------------------

test('sign-in page shows "request access" guidance text', async ({ page }) => {
  await page.goto('/sign-in');
  const body = await page.textContent('body');
  // FR-02: sign-in page should mention admin access
  expect(body?.toLowerCase()).toMatch(/admin|access/i);
});

// ---------------------------------------------------------------------------
// Authenticated page empty states (Phase 9: requires globalSetup + session)
// ---------------------------------------------------------------------------

test.skip(
  'dashboard empty state — "No active sprint" copy visible on fresh org — requires auth session (Phase 9)',
  async ({ page }) => {
    // Phase 9 implementation:
    // 1. globalSetup seeds a fresh org (one admin, no sprints, no todos).
    // 2. Inject session cookie for admin.
    // 3. Navigate to /dashboard.
    await page.goto('/dashboard');

    // PRD: "No active sprint — plan one to start tracking goals"
    await expect(
      page.getByText(/No active sprint/i),
    ).toBeVisible();

    // PRD: "Nothing on your plate."
    await expect(
      page.getByText(/Nothing on your plate/i),
    ).toBeVisible();

    // PRD: "No todos due in the next 7 days."
    await expect(
      page.getByText(/No todos due in the next 7 days/i),
    ).toBeVisible();

    // PRD: "Activity will appear here as your team uses the app."
    await expect(
      page.getByText(/Activity will appear here as your team uses the app/i),
    ).toBeVisible();
  },
);

test.skip(
  'sprints page empty state — "No sprints yet. Plan your first sprint." — requires auth session (Phase 9)',
  async ({ page }) => {
    await page.goto('/sprints');
    await expect(page.getByText(/No sprints yet/i)).toBeVisible();
    await expect(page.getByText(/Plan your first sprint/i)).toBeVisible();
  },
);

test.skip(
  'backlog page empty state — "No backlog todos" — requires auth session (Phase 9)',
  async ({ page }) => {
    await page.goto('/todos');
    await expect(page.getByText(/No backlog todos/i)).toBeVisible();
  },
);

test.skip(
  'my todos page empty state — "Nothing on your plate" — requires auth session (Phase 9)',
  async ({ page }) => {
    await page.goto('/todos/mine');
    await expect(page.getByText(/Nothing on your plate/i)).toBeVisible();
  },
);

test.skip(
  'bell menu empty state — "You\'re all caught up." — requires auth session (Phase 9)',
  async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page.getByText(/You.re all caught up/i)).toBeVisible();
  },
);
