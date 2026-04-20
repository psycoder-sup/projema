---
name: FR-04 sign-out requirement
description: PRD FR-04 mandates a sign-out affordance on every authenticated screen; auth-signout e2e test enforces this.
type: project
---

PRD FR-04: "Users can sign out from a menu accessible on every screen." The spec (sprint-todo-management-spec.md §Global Header) names the affordance as a top-right user-menu dropdown, and `tests/e2e/auth-signout.spec.ts` has a (currently skipped) test asserting `getByRole('button', { name: /account menu/i })` + `getByRole('menuitem', { name: /sign out/i })` on `/dashboard`.

**Why:** It is a product requirement, not just UX polish — removing it is a regression against the PRD and breaks the contract the e2e suite will eventually verify (Phase 9).

**How to apply:** Whenever reviewing shell/layout/header changes under `src/app/(app)/` or `src/components/layout/`, verify that a sign-out control remains reachable (NextAuth `signOut` call) and that an element matching the e2e selectors (`aria-label="Account menu"` button opening a menu with a "Sign out" menuitem) still exists.
