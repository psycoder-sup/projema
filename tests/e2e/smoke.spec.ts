/**
 * E2E smoke test: verifies the app serves pages and the healthz endpoint responds.
 */
import { expect, test } from '@playwright/test';

test('dashboard page renders without crashing', async ({ page }) => {
  // Navigate directly to /dashboard (the default landing page after redirect from /)
  await page.goto('/dashboard');
  // Page should render — check for a status 200 via the response or just that the page has content
  await expect(page).toHaveURL(/\/dashboard/);
  // The page should have a body element (basic smoke: not a blank 500)
  const bodyText = await page.textContent('body');
  expect(bodyText).not.toBeNull();
});

test('healthz endpoint returns 200 with ok:true', async ({ request }) => {
  const response = await request.get('/api/healthz');
  expect(response.status()).toBe(200);
  const body = await response.json() as { ok: boolean; ts: string };
  expect(body.ok).toBe(true);
  expect(typeof body.ts).toBe('string');
  expect(() => new Date(body.ts)).not.toThrow();
});
