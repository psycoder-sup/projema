# SPEC: Sprint Todo Management

**Based on:** `docs/feature/sprint-todo-management/sprint-todo-management-prd.md` (v1.0, 2026-04-16)
**Author:** CTO Agent
**Date:** 2026-04-16
**Version:** 1.2
**Status:** Approved

**Revision history:**
- 1.0 (2026-04-16): Initial draft.
- 1.1 (2026-04-16): Applied first-review fixes — committed to Vercel deployment, tightened FK cascades to `RESTRICT`, specified raw-SQL partial unique index in init migration, defined `updateTodo` PATCH semantics, `activateSprint` conflict UX, and transactional boundaries, decomposed dashboard latency budget with cold-start strategy, added `seedTodo` fixture contract and missing test skeletons, documented cross-user cache SLA, resolved due-date timezone semantics, deprecated `todo_completed` event in favor of `todo_status_changed{to:'done'}`. Three security items deferred to v1.1.
- 1.2 (2026-04-16): Applied second-review fixes — reconciled `listTodos` filter contract between §3 and §13.5 (typed `sprintScope` union used everywhere), made `getDashboardData` a plain async server function (not a server action) and updated dashboard tests, expanded `ServerActionError` into a discriminated union on `code` so `active_sprint_conflict` carries `currentActiveSprintId` as a typed field, added concurrent-edit protection to `saveTodoDocument` (matches `updateTodo`), spec'd `P2002` remap to `active_sprint_conflict` on the no-current-active race, locked the `completed_at` invariant for `activateSprint`, added 24h Auth.js session `maxAge` as interim mitigation for the deferred session revocation, **closed the link-scheme allow-list in v1** (Zod `.refine()` + DB `CHECK`), added skeletons for `markAllNotificationsRead` race, XSS payload set, and link-scheme rejection, added `refetchInterval` to `useTodoComments` / `useTodoDetail` to honor the 15s cross-user SLA, documented `@updatedAt` convention (DB trigger is the writer, not Prisma) and the Zod key-presence discriminator pattern for PATCH inputs, fixed "my todos nulls last" test to actually exercise null ordering.

---

## 1. Overview

This SPEC defines the technical architecture and implementation plan for the Sprint Todo Management MVP described in the PRD. Because the repo is greenfield, this document also establishes the foundational stack for the project.

The feature set — sprints with named goals, todos attached to sprints/goals, a personal dashboard, comments, an activity feed, in-app notifications, markdown docs up to 100KB, Google/GitHub SSO, single-org allowlist, ~15 concurrent users — is best served by a boring, monolithic full-stack web application. There is no requirement justifying microservices, a separate backend, or a real-time event bus. The architecture proposed here is a single Next.js application (App Router) with server actions and route handlers talking to a single Postgres database via Prisma, deployed on **Vercel serverless**. Background jobs (the 24-hour-due notification sweep and WAU rollup) run as **Vercel Cron** entries hitting protected `/api/cron/*` route handlers. There is no long-running Node process; all server code is stateless function invocations.

**Stack at a glance, with one-line justifications:**

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) | Single language for client and server; aligns with the React/Next ecosystem; catches shape bugs at compile time. |
| Web framework | Next.js 14+ App Router | Dominant full-stack React framework; server components + server actions remove the need for a separate API layer for a team of this size. |
| UI | React 18 + Tailwind CSS + shadcn/ui (Radix primitives) | Standard modern React stack; shadcn gives us accessible, editable primitives without a heavy component library; matches the PRD's responsive/desktop-first layout needs. |
| Data fetching / cache | TanStack Query (React Query) for client cache; server components for initial render | TanStack Query is the de-facto standard for cache keys, invalidation, and optimistic updates on the client — all of which the dashboard and todo detail need. |
| DB | PostgreSQL 15+ (managed, e.g. Neon, Supabase Postgres, or RDS) | Relational data, multi-entity joins (sprint → goal → todo → comment → user), needs transactions for assignment + notification + activity logging. Postgres is the boring correct answer. |
| ORM | Prisma | Type-safe queries from TS; migrations are first-class; fits the small-team shape. |
| Auth | Auth.js (NextAuth v5) with Google + GitHub providers, Prisma adapter | Auth.js is the canonical Next.js auth library; handles OAuth, sessions, CSRF, and DB-backed user records out of the box. |
| Markdown | `react-markdown` with `remark-gfm`, rendered on the client with a server-side DOMPurify-equivalent sanitizer (`isomorphic-dompurify`) | GFM support per FR-17; sanitization is mandatory because FR-17 admits arbitrary user paste. |
| Validation | Zod | Shared client/server schemas; pairs naturally with server actions. |
| Jobs | **Vercel Cron** entries hitting protected `/api/cron/*` route handlers | 24h-due sweeps and WAU rollups run every 15 minutes. Vercel Cron declares a single schedule per entry (no instance fan-out), so duplicate invocations are not a concern in normal operation; the DB-level partial unique index in §2 is the defense-in-depth guard. |
| Notifications transport | In-app only, polled every 30s via TanStack Query; upgrade path to Server-Sent Events later | PRD says in-app only (FR-27); polling is simplest and stays correct under ~15 users. **Cross-user visibility SLA is the poll interval (30s)** — see §4. |
| Rate limiting | **Postgres-backed sliding window** via a `rate_limit_buckets` table (Vercel serverless is stateless, so no in-process token bucket) | Enforced across all function invocations. 10/minute on `postComment` and `saveTodoDocument` per PRD. |
| Testing | Vitest (unit + integration), Playwright (e2e), Testcontainers-postgres for integration | Vitest fits the TS stack; Playwright for browser e2e; real Postgres via Testcontainers so integration tests exercise real access policies and constraints. |
| Analytics | PostHog (self-hosted or cloud) | Event taxonomy in PRD §8 maps directly onto PostHog events; WAU dashboard comes for free. |
| Hosting | **Vercel** (app + Vercel Cron) + managed Postgres (Neon, default) | Committed. See §11. |

The design prioritizes shipping the MVP fast and keeping the data model honest. Every PRD functional requirement maps to a specific server action, route handler, or background job named in this spec.

---

## 2. Database Schema

All tables live in the default `public` schema of a single Postgres database. All primary keys are `uuid` generated server-side (via `gen_random_uuid()` or Prisma `@default(uuid())`). All timestamps are `timestamptz`, defaulting to `now()` where appropriate. Names use `snake_case` in DB, `camelCase` in Prisma models.

### New Tables

#### `users`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` | User ID. |
| `email` | text | NOT NULL, UNIQUE, lowercased | OAuth email. |
| `display_name` | text | NOT NULL | Name from OAuth provider. |
| `avatar_url` | text | NULL | OAuth avatar. |
| `role` | text | NOT NULL, CHECK in (`admin`, `member`), default `member` | Admin-vs-member. |
| `is_active` | boolean | NOT NULL, default true | False when admin removes the user; preserves FKs for historical records. |
| `last_seen_at` | timestamptz | NULL | Updated on each session start; feeds WAU. |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | Maintained by a Postgres `BEFORE UPDATE` trigger (see "Triggers" below) — not Prisma middleware, so raw SQL paths also stay accurate. |

#### `accounts` (Auth.js)

Standard Auth.js `Account` table. Stores linked OAuth providers. One row per (user, provider) pair. Columns: `id`, `user_id` (FK users.id), `provider` (`google`|`github`), `provider_account_id`, `access_token`, `refresh_token`, `expires_at`, `token_type`, `scope`, `id_token`. Auth.js manages this entirely.

#### `sessions` (Auth.js)

Standard Auth.js `Session` table. Columns: `id`, `session_token` (UNIQUE), `user_id` (FK users.id), `expires`. Auth.js manages.

#### `verification_tokens` (Auth.js)

Required by Auth.js schema even if unused for OAuth-only.

#### `allowlist_entries`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `email` | text | NOT NULL, UNIQUE, lowercased | The email allowed to sign in. |
| `added_by_user_id` | uuid | FK users.id, NOT NULL | Admin who added. |
| `added_at` | timestamptz | NOT NULL, default `now()` | |

The admin-managed list per FR-02/FR-03. The first signup is admitted when the table is empty AND `users` is empty, at which point that user becomes `admin`.

#### `sprints`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `name` | text | NOT NULL, CHECK length ≤ 140 | Sprint name. |
| `start_date` | date | NOT NULL | |
| `end_date` | date | NOT NULL, CHECK `end_date >= start_date` | FR-05. |
| `status` | text | NOT NULL, CHECK in (`planned`, `active`, `completed`), default `planned` | FR-06. |
| `created_by_user_id` | uuid | FK users.id, NOT NULL | |
| `completed_at` | timestamptz | NULL | Set when status transitions to `completed`. |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

#### `sprint_goals`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `sprint_id` | uuid | FK sprints.id ON DELETE CASCADE, NOT NULL | |
| `name` | text | NOT NULL, CHECK length ≤ 140 | |
| `position` | integer | NOT NULL, default 0 | For stable display order. |
| `created_at` | timestamptz | NOT NULL | |

UNIQUE constraint on `(sprint_id, lower(name))` to enforce per-sprint goal name uniqueness (FR-05).

#### `todos`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `title` | text | NOT NULL, CHECK length ≤ 140 | FR-11. |
| `description` | text | NULL, CHECK length ≤ 4000 | FR-11. |
| `status` | text | NOT NULL, CHECK in (`todo`, `in_progress`, `done`), default `todo` | FR-11. |
| `priority` | text | NOT NULL, CHECK in (`low`, `medium`, `high`), default `medium` | FR-11. |
| `assignee_user_id` | uuid | FK users.id ON DELETE SET NULL, NULL | FR-11. Kept `SET NULL` because users are soft-deactivated (`is_active=false`); actual row deletion is not part of the admin flow. |
| `due_date` | date | NULL | FR-11. See "Due-date timezone semantics" below. |
| `sprint_id` | uuid | FK sprints.id **ON DELETE RESTRICT**, NULL | FR-12/FR-13. RESTRICT (not SET NULL) so a raw-SQL sprint delete never silently orphans todos into the backlog. Application-level detach must be an explicit `UPDATE todos SET sprint_id=NULL WHERE id=?`. |
| `sprint_goal_id` | uuid | FK sprint_goals.id **ON DELETE RESTRICT**, NULL | FR-12/FR-16. RESTRICT for the same reason; `deleteSprintGoal` performs explicit `UPDATE todos SET sprint_goal_id=NULL WHERE sprint_goal_id=?` before deleting the goal when `strategy='detach_todos'`. |
| `created_by_user_id` | uuid | FK users.id, NOT NULL | |
| `completed_at` | timestamptz | NULL | Set on transition to `done`, cleared on reopen (FR-15). |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | Used for the "last write wins" stale-edit toast (see §9). |

**Integrity rule (CHECK constraint):** `sprint_goal_id` may be non-null only if `sprint_id` is non-null AND the referenced goal's `sprint_id` equals this row's `sprint_id`. The cross-row part is enforced by a database trigger (`trg_todo_goal_in_sprint`) that raises an error on insert/update if violated, since Postgres CHECK constraints cannot join across rows.

#### `todo_links`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `todo_id` | uuid | FK todos.id ON DELETE CASCADE, NOT NULL | |
| `url` | text | NOT NULL, CHECK length ≤ 2048 AND `url ~* '^(https?\|mailto):'` | Scheme restricted to `http`, `https`, or `mailto`. Zod layer additionally runs `new URL(u)` and checks `protocol`. Prevents `javascript:` / `data:` rendered anchors. |
| `label` | text | NULL, CHECK length ≤ 140 | Optional display label. |
| `position` | integer | NOT NULL, default 0 | |
| `created_at` | timestamptz | NOT NULL | |

Separate table (rather than a JSON array on `todos`) to keep links queryable and orderable.

#### `todo_documents`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `todo_id` | uuid | PK, FK todos.id ON DELETE CASCADE | One doc per todo max (FR-11). |
| `content_markdown` | text | NOT NULL, CHECK `octet_length(content_markdown) <= 102400` | 100KB cap enforced at DB level. |
| `updated_at` | timestamptz | NOT NULL | |
| `updated_by_user_id` | uuid | FK users.id, NOT NULL | |

Stored inline as `text` rather than in object storage: 100KB per doc × ~small-n todos fits comfortably in Postgres and removes a whole infrastructure dependency.

#### `comments`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `todo_id` | uuid | FK todos.id ON DELETE CASCADE, NOT NULL | |
| `author_user_id` | uuid | FK users.id, NOT NULL | |
| `body` | text | NOT NULL, CHECK length ≤ 2000 | FR-18. |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `edited_at` | timestamptz | NULL | Set on edit (FR-19). |

#### `activity_events`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `actor_user_id` | uuid | FK users.id, NOT NULL | |
| `kind` | text | NOT NULL, CHECK in (`todo_created`, `todo_status_changed`, `todo_assigned`, `comment_posted`, `sprint_created`, `sprint_activated`, `sprint_completed`) | `todo_completed` was intentionally not included — completion is `todo_status_changed` with `payload_json -> to = 'done'`. Avoids dedup logic in the feed. |
| `target_todo_id` | uuid | FK todos.id ON DELETE SET NULL, NULL | |
| `target_sprint_id` | uuid | FK sprints.id ON DELETE SET NULL, NULL | |
| `payload_json` | jsonb | NULL | Event-specific parameters, e.g. `{"from":"todo","to":"in_progress"}`. |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

Separate from the analytics provider because this table powers the Team Activity UI (FR-20) and must be queryable with filters/joins; analytics events are also sent to PostHog in parallel.

#### `notifications`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `user_id` | uuid | FK users.id, NOT NULL | Recipient. |
| `kind` | text | NOT NULL, CHECK in (`assigned`, `due_soon`, `comment_on_assigned`) | FR-25. |
| `target_todo_id` | uuid | FK todos.id ON DELETE CASCADE, NOT NULL | |
| `triggered_by_user_id` | uuid | FK users.id, NULL | |
| `read_at` | timestamptz | NULL | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

Uniqueness: partial unique index on `(user_id, target_todo_id, kind)` WHERE `kind = 'due_soon'` prevents the background job from re-notifying the same user about the same todo's < 24h window on every run.

#### `sessions_log` (analytics of sign-ins)

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `user_id` | uuid | FK users.id, NOT NULL | |
| `provider` | text | NOT NULL, CHECK in (`google`, `github`) | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

Feeds FR-28 WAU. Separate from Auth.js `sessions` (which stores cookies/tokens).

#### `rate_limit_buckets`

| Column | Type | Constraints / Default | Description |
|--------|------|-----------------------|-------------|
| `id` | uuid | PK | |
| `user_id` | uuid | FK users.id ON DELETE CASCADE, NOT NULL | Rate-limited principal. |
| `action_key` | text | NOT NULL | e.g. `postComment`, `saveTodoDocument`. |
| `event_at` | timestamptz | NOT NULL, default `now()` | Timestamp of a counted event. |

Used by the Postgres-backed sliding-window rate limiter (Vercel is stateless; no in-process counters). Counts in the last 60 seconds determine whether to reject. A scheduled cleanup (part of `cleanupStaleNotifications` job) deletes rows older than 10 minutes.

### Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `users` | `email` UNIQUE | Login lookup. |
| `allowlist_entries` | `email` UNIQUE | Allowlist check on sign-in. |
| `sprints` | `(status, start_date DESC)` | Sprints list grouped by status (FR-21). |
| `sprints` | partial UNIQUE on `(status)` WHERE `status = 'active'` | Enforces "at most one active sprint" at DB level (FR-07) defense-in-depth. **Prisma's declarative schema cannot express partial unique indexes**, so this must be added as raw SQL in the `20260416_init` migration (see §11). |
| `sprint_goals` | `(sprint_id, position)` | Sprint detail goal ordering. |
| `sprint_goals` | UNIQUE `(sprint_id, lower(name))` | Per-sprint unique goal names (FR-05). |
| `todos` | `(assignee_user_id, status, due_date ASC)` | My Todos query (FR-20, FR-24). |
| `todos` | `(sprint_id, sprint_goal_id)` | Sprint detail (FR-22); also serves `WHERE sprint_id = ?` as a prefix scan. Verified with `EXPLAIN` in the integration test gate. |
| `todos` | `(assignee_user_id)` | Filter by assignee without status predicate (e.g., "reassign on deactivation"). |
| `todos` | partial `(due_date)` WHERE `status <> 'done'` | Upcoming deadlines & due-soon job. |
| `todos` | partial `(sprint_id)` WHERE `sprint_id IS NULL` | Backlog view (FR-23). |
| `comments` | `(todo_id, created_at)` | Todo detail comment feed. |
| `activity_events` | `(created_at DESC)` | Team Activity dashboard query. |
| `activity_events` | `(target_todo_id, created_at DESC)` | Optional per-todo history (future). |
| `notifications` | `(user_id, read_at, created_at DESC)` | Bell menu query. |
| `notifications` | partial UNIQUE `(user_id, target_todo_id, kind)` WHERE `kind = 'due_soon'` | Deduplicate due-soon notifications. |
| `sessions_log` | `(user_id, created_at DESC)` | WAU window query. |
| `rate_limit_buckets` | `(user_id, action_key, event_at DESC)` | Sliding-window count per principal/action. |

### Access Policies

Access control is implemented in the application layer inside server actions / route handlers, not in Postgres Row-Level Security. Rationale: single-org app, small team, no multi-tenant isolation; RLS would add operational cost without a real threat to mitigate. The DB is accessed only by the app (single connection pool via Prisma); no direct client access.

Policy matrix (enforced in server-side guards):

| Resource | Read | Create | Update | Delete |
|----------|------|--------|--------|--------|
| sprints | any authenticated member | any member | any member | any member, only if `status = 'planned'` AND no attached todos (FR-09) |
| sprint_goals | any member | any member | any member | any member; if todos are attached the UI must call the detach-or-cancel flow first (FR-08) |
| todos | any member | any member | any member (FR-14) | any member (FR-14) |
| todo_links | any member | any member | any member | any member |
| todo_documents | any member | any member | any member (size-checked) | any member |
| comments | any member | any member (as author) | only the author (FR-19) | only the author (FR-19) |
| activity_events | any member | system-only (via service layer) | none | none |
| notifications | only the recipient | system-only | only the recipient (to mark read) | only the recipient |
| allowlist_entries | only `admin` | only `admin` (FR-03) | only `admin` | only `admin` |
| users.role | only `admin` | — | only `admin` (cannot demote last admin) | — |
| users.is_active | only `admin` | — | only `admin` (cannot deactivate last admin) | — |

Every server action begins with a session check (`auth()`) and a role/ownership check before touching the DB. See §9 for the concrete guard layer.

### Table Modifications

None — greenfield.

### Triggers

- `trg_todo_goal_in_sprint` (already referenced): `BEFORE INSERT OR UPDATE OF sprint_goal_id, sprint_id ON todos` — raises if `sprint_goal_id IS NOT NULL` AND the referenced goal's `sprint_id` differs from the row's `sprint_id` (or the row's `sprint_id` is NULL).
- `trg_set_updated_at_<table>` on `users`, `sprints`, `sprint_goals`, `todos`, `todo_documents`, `comments`: `BEFORE UPDATE` sets `NEW.updated_at = now()`. Replaces the originally-proposed Prisma middleware so seeds, raw SQL fixes, and migrations also keep `updated_at` honest (load-bearing for stale-edit detection in §9). **Convention: Prisma models do NOT use the `@updatedAt` directive — the DB trigger is the only writer of `updated_at`.** This is enforced by a lint check that greps `prisma/schema.prisma` for `@updatedAt`.

### Due-date timezone semantics

- All `date`-typed columns (`sprints.start_date`, `sprints.end_date`, `todos.due_date`) are calendar-date values in the **org's configured timezone** (env `ORG_TIMEZONE`, default `UTC`). There is no per-user timezone in v1.
- "Due within 24 hours" for the `sweepDueSoonNotifications` job (FR-25) is evaluated as: the todo's `due_date` falls on or before `date_trunc('day', now() AT TIME ZONE $ORG_TIMEZONE) + INTERVAL '1 day'`. In other words, a todo due "today" or "tomorrow" (org-local) is in the window; a todo due the day after tomorrow is not.
- The cron schedule fires every 15 minutes (wall clock). The partial unique index on `notifications(user_id, target_todo_id, kind) WHERE kind='due_soon'` ensures a given todo produces at most one `due_soon` notification per user per *lifetime* (not per day), which matches the PRD intent: notify once as the window opens.
- Sprint end date "2026-04-16" ends at 23:59:59 in `ORG_TIMEZONE`. Sprint auto-activation on the start date is **not** implemented in v1 (manual activation only — Open Question 2 in PRD).

### Transactional boundaries

Every server action that mutates a row and also emits activity events and/or notifications must perform all writes inside a single `prisma.$transaction`. PostHog emission and Sentry breadcrumbs happen in the `.then` after the transaction commits so a rolled-back mutation never emits a success event. Specifically this applies to: `createSprint`, `updateSprint`, `deleteSprint`, `deleteSprintGoal`, `activateSprint`, `completeSprint`, `createTodo`, `updateTodo` (including status change, assignee change, sprint/goal change — all in one txn), `deleteTodo`, `saveTodoDocument`, `deleteTodoDocument`, `postComment`, `editComment`, `deleteComment`, `markNotificationRead`, `markAllNotificationsRead`, `deactivateUser`. The admin allowlist writes (`addAllowlistEmail`, `removeAllowlistEmail`) also emit activity implicitly via admin-audit and use the same pattern.

### Data Flow

1. **User signs in:** browser → Auth.js OAuth redirect → provider → callback → Auth.js checks `allowlist_entries` (or bootstraps first user) → creates/updates `users` row → writes `sessions_log` entry → sets session cookie → user lands on `/dashboard`.
2. **User creates a todo:** browser form → Next.js server action `createTodo` → Zod validation → Prisma `todos.create` + `activity_events.create` + (if assignee set & different from actor) `notifications.create` — all in one transaction → TanStack Query invalidates `todos.list`, `dashboard.myTodos`, `dashboard.activity` → UI re-renders.
3. **Dashboard load:** server component for `/dashboard` fetches the four sections in parallel (active sprint with per-goal counts; my todos; upcoming deadlines; last 15 activity events) via a single Prisma call each → returns server-rendered HTML → client hydrates with TanStack Query cache pre-populated → bell unread count polls every 30s.
4. **Due-soon sweep:** Vercel Cron fires every 15 minutes → handler reads all todos with `status <> 'done'` AND `due_date <= date_trunc('day', now() AT TIME ZONE $ORG_TIMEZONE) + INTERVAL '1 day'` AND an assignee → upserts `notifications` rows (`kind='due_soon'`) using the partial unique index to dedupe.

---

## 3. API Layer

Next.js App Router with server actions as the primary API surface. Route handlers (`app/api/.../route.ts`) used only where actions don't fit: the Auth.js catch-all (`/api/auth/[...nextauth]`), the notifications long-poll / SSE endpoint, and the analytics admin export.

All server actions are defined in `src/server/actions/<domain>.ts`, take a Zod-validated input, return a discriminated-union result `{ ok: true, data } | { ok: false, error: { code, message, field? } }`. No thrown errors cross the server-client boundary except framework errors.

### Server Actions

#### Sprints

| Action | Input | Output | Called From | Notes |
|--------|-------|--------|-------------|-------|
| `createSprint` | `{ name, startDate, endDate, goals: string[] }` | `{ sprint, goals }` | Sprints "New sprint" form | Validates dates, uniqueness of goal names, caller is authenticated. Records `activity_events(sprint_created)`. Sends PostHog `sprint_created`. |
| `updateSprint` | `{ id, name?, startDate?, endDate?, goalsUpsert?: [{ id?, name }] }` | `{ sprint, goals }` | Sprint edit form | Allowed in any status (FR-08). Goal upserts with name conflict detection. |
| `deleteSprint` | `{ id }` | `{ ok }` | Sprints list action menu | Rejects unless `status='planned'` and `count(todos where sprint_id=id)=0` (FR-09). |
| `deleteSprintGoal` | `{ goalId, strategy: 'detach_todos' | 'cancel' }` | `{ ok, detachedTodoCount? }` | Sprint edit goal delete | If todos attached and strategy='detach_todos', null out their `sprint_goal_id` in same txn. |
| `activateSprint` | `{ id, acknowledgedCompletingId?: string }` | `{ sprint, completedSprintId? }` OR on conflict: `{ error: { code: 'active_sprint_conflict', currentActiveSprintId: string } }` | "Make active" button | If another sprint is `active`, require `acknowledgedCompletingId` to match it. **On conflict, the server returns the id of the actually-active sprint in the error payload** so the client can re-render the confirmation dialog with the fresh id and the user re-acks without a page refresh. Txn flips old to `completed` (and sets its `completed_at = now()`) + new to `active`. Records `activity_events(sprint_activated)` and, if applicable, `sprint_completed`. **Race handling:** when no sprint is currently active but two concurrent calls try to activate different planned sprints, the second call will hit the partial unique index `sprints_one_active_idx` and Prisma throws `P2002`. The action **catches `P2002` on that index**, re-reads the now-winning active sprint, and remaps to `active_sprint_conflict { currentActiveSprintId }`, so the client receives the same shape as any other conflict. |
| `completeSprint` | `{ id }` | `{ sprint, totals: { todoTotal, todoDone, goalCount, fullyCompletedGoalCount } }` | Sprint detail "Complete sprint" | Confirmation totals also computed server-side so the confirmation dialog can show them (flow step 3 in §6 of PRD). Records `activity_events(sprint_completed)` and PostHog. |

#### Todos

| Action | Input | Output | Called From | Notes |
|--------|-------|--------|-------------|-------|
| `createTodo` | `{ title, description?, status?, priority?, assigneeUserId?, dueDate?, sprintId?, sprintGoalId?, links?: [{ url, label? }] }` | `{ todo }` | Global "+ New todo" header, todo form | Validates sprint/goal consistency, links URL format. Emits `todo_created` activity + PostHog. |
| `updateTodo` | `{ id, expectedUpdatedAt?, ...patch }` | `{ todo, stale?: boolean }` | Todo detail | **PATCH semantics:** for every nullable field (`assigneeUserId`, `dueDate`, `sprintId`, `sprintGoalId`, `description`), **key absent = no-op; key present with `null` = unset; key present with a value = set**. Implementation note: Zod's `.optional()` output strips undefined values, which collapses "absent" and "present-undefined." The action layer therefore branches on **`Object.prototype.hasOwnProperty.call(rawInput, field)` on the pre-parsed JSON body**, not on `parsed[field] !== undefined`. The Zod schema uses `.optional().nullable()` on each field and the action passes the raw body (not just the parsed object) to the mapper. Enforced per-field in §13.5 tests. `expectedUpdatedAt` enables last-write-wins stale detection — if older than the row's `updated_at`, the action still writes (last write wins per PRD §6) but returns `stale=true` plus the current `updated_at` and the last actor's display name. Also triggers `todo_status_changed`, `todo_assigned` activity + notifications as appropriate. All writes happen inside one transaction (see §2 "Transactional boundaries"). Detaching the sprint (setting `sprintId: null`) also clears `sprintGoalId` server-side per FR-16, regardless of whether the client sent the goal key. |
| `deleteTodo` | `{ id }` | `{ ok }` | Todo detail action menu | Cascades to links, document, comments, and, via ON DELETE CASCADE, `notifications`. |
| `addTodoLink` / `removeTodoLink` | `{ todoId, url, label? }` / `{ linkId }` | `{ link }` / `{ ok }` | Todo detail link list | Separate endpoints so reordering/editing links doesn't require re-posting the whole todo. |
| `saveTodoDocument` | `{ todoId, contentMarkdown, expectedUpdatedAt?: string }` | `{ doc, stale?: boolean }` | Markdown editor panel | Size check in Zod + DB CHECK; returns field error `document_too_large` if > 100KB. **Concurrent-edit handling matches `updateTodo`:** if `expectedUpdatedAt` is supplied and older than the doc's current `updated_at`, the action still writes (last-write-wins per PRD §6) but returns `stale=true` plus the newer updater's display name so the editor can surface the same stale toast. Resolves §15 Q4 in favor of identical treatment for doc and todo fields. |
| `deleteTodoDocument` | `{ todoId }` | `{ ok }` | Todo detail | |

#### Comments

| Action | Input | Output | Called From | Notes |
|--------|-------|--------|-------------|-------|
| `postComment` | `{ todoId, body }` | `{ comment }` | Todo detail comment box | Emits `comment_posted` activity + PostHog; if todo has an assignee and assignee != author, creates `notifications(kind='comment_on_assigned')`. |
| `editComment` | `{ id, body }` | `{ comment }` | Inline comment edit | Author-only; sets `edited_at`. |
| `deleteComment` | `{ id }` | `{ ok }` | Inline comment menu | Author-only. |

#### Notifications

| Action | Input | Output | Called From | Notes |
|--------|-------|--------|-------------|-------|
| `listNotifications` | `{}` | `{ items: Notification[], unreadCount: number }` | Bell menu poll | Returns last 20 + unread count. |
| `markNotificationRead` | `{ id }` | `{ ok }` | Clicking a bell item | Also fires PostHog `notification_opened`. Navigation to target happens client-side after server response. |
| `markAllNotificationsRead` | `{ upToCreatedAt: string }` | `{ ok, markedCount: number }` | "Mark all as read" button | Client sends the `createdAt` of the newest notification visible to the user at click time. Server only marks rows with `created_at <= upToCreatedAt`, so a notification that arrives between the user seeing the list and clicking "mark all" is not silently marked read. |

#### Admin

| Action | Input | Output | Called From | Notes |
|--------|-------|--------|-------------|-------|
| `addAllowlistEmail` | `{ email }` | `{ entry }` | Admin screen | Admin-only. Normalizes to lowercase. |
| `removeAllowlistEmail` | `{ entryId }` | `{ ok }` | Admin screen | |
| `deactivateUser` | `{ userId }` | `{ ok }` | Admin screen | Sets `users.is_active=false`, reassigns nothing (todos remain). Rejects if target is the last active admin. |

#### Queries (read endpoints used from client; most reads live in server components)

| Query | Input | Output | Notes |
|-------|-------|--------|-------|
| `listSprints` | `{ status? }` | `Sprint[]` with goal counts | For `/sprints` view grouped by status. |
| `getSprintDetail` | `{ id }` | `Sprint & { goals, todosGrouped }` | For `/sprints/[id]`. |
| `listTodos` | `{ filter: { assigneeUserId?, status?, priority?, sprintScope?: { kind: 'any' } \| { kind: 'backlog' } \| { kind: 'sprint'; sprintId: string } } }` | `Todo[]` | Shared by Backlog, My Todos, sprint detail. Typed union (rather than a `string \| 'backlog'` sentinel) so the type system distinguishes "no filter", "backlog only", and "specific sprint". |
| `getTodoDetail` | `{ id }` | `Todo & { links, document, comments, sprint, goal, assignee }` | |
| `getDashboardData` | `{ actor: User }` | `DashboardData` (raw, not wrapped in `Result<T,E>`) | Plain async server function (not a server action). Called from the `/dashboard` server component during SSR and from integration tests directly. Client views use the four narrower hooks (§4). |
| `listActivity` | `{ limit?, before? }` | `ActivityEvent[]` | Paginated activity feed. |
| `adminGetWau` | `{}` | `{ totalMembers, wauCount, wauWindow: { start, end } }` | FR-28. |

### Server Functions (background jobs)

| Job | Schedule | Input | Output | Logic |
|-----|----------|-------|--------|-------|
| `sweepDueSoonNotifications` | Every 15 minutes via **Vercel Cron** (hits `/api/cron/sweep-due-soon`) | — | `{ notificationsCreated: number }` | Selects todos where `status <> 'done'` AND `due_date <= date_trunc('day', now() AT TIME ZONE $ORG_TIMEZONE) + INTERVAL '1 day'` AND `assignee_user_id IS NOT NULL`. Upserts `notifications(kind='due_soon')` using `ON CONFLICT DO NOTHING` against the partial unique index. No-op if a row already exists. See §2 "Due-date timezone semantics". |
| `rollupWeeklyActive` | Every hour via Vercel Cron (`/api/cron/rollup-wau`) | — | — | Refreshes a materialized cache of `users.last_seen_at >= now() - interval '7 days'` into a simple count accessible by `adminGetWau`. Optional for v1; MVP can compute on-demand. |
| `cleanupStaleNotifications` | Daily at 03:00 UTC via Vercel Cron (`/api/cron/cleanup`) | — | `{ deleted }` | Deletes read notifications older than 30 days and `rate_limit_buckets` rows older than 10 minutes to keep tables tight. |

Vercel Cron declares a single schedule per endpoint and does not fan out concurrent invocations in normal operation, so the `pg_try_advisory_lock` wrapper originally proposed is not required. A lightweight safety check is kept anyway: each cron handler validates a `CRON_SECRET` header (shared secret Vercel sets on scheduled invocations) and no-ops if the secret is missing — preventing accidental manual hits. The real correctness guarantee for duplicate-sensitive writes is the partial unique index on `notifications(..., kind='due_soon')`.

### Route Handlers (non-action endpoints)

- `/api/auth/[...nextauth]` — Auth.js catch-all.
- `/api/notifications/poll` — JSON endpoint returning same shape as `listNotifications`; clients use TanStack Query polling. If/when SSE is added in v1.1, this endpoint upgrades.
- `/api/admin/wau` — JSON for admin dashboard, role-checked.
- `/api/cron/sweep-due-soon`, `/api/cron/rollup-wau`, `/api/cron/cleanup` — Vercel Cron targets; each validates a `CRON_SECRET` header.
- `/api/healthz` — uptime ping.

---

## 4. State Management

### Query / Cache Hooks

All client-side reads use TanStack Query. Cache keys are structured as `[domain, subdomain, ...params]` strings.

| Hook | Cache Key | Stale Time | Invalidated By | Notes |
|------|-----------|------------|----------------|-------|
| `useDashboardActiveSprint` | `['dashboard', 'activeSprint']` | 30s | `createSprint`, `activateSprint`, `completeSprint`, any `updateTodo` whose **old or new** `sprintId` matches the current active sprint, `createTodo`, `deleteTodo` | Cheap query; always fresh-ish. |
| `useMyTodos` | `['dashboard', 'myTodos', userId]` | 30s | any todo mutation touching the current user's assignment | Capped at 10 results per FR-20. |
| `useUpcomingDeadlines` | `['dashboard', 'upcomingDeadlines']` | 30s | any todo mutation | Window `now()..+7d`, status ≠ done. |
| `useTeamActivity` | `['dashboard', 'activity']` | 30s | any mutation that produces activity | Last 15 events per FR-20. |
| `useSprintList` | `['sprints', 'list', { status }]` | 60s | sprint mutations | |
| `useSprintDetail` | `['sprints', 'detail', id]` | 30s | sprint/goal mutations with matching id; any `updateTodo` whose **old or new** `sprintId` equals `id` (so moving a todo between sprints invalidates both detail views) | |
| `useTodoList` | `['todos', 'list', filter]` | 30s | todo mutations | |
| `useTodoDetail` | `['todos', 'detail', id]` | 15s | `updateTodo(id)`, `postComment`, `editComment`, `deleteComment`, link/doc changes | **`refetchInterval: 15000` while the detail view is open** so idle viewers see cross-user updates within the 15s SLA. |
| `useTodoComments` | `['todos', 'comments', todoId]` | 15s | comment mutations on that todo | Separated so comment posts don't force refetch of the whole todo. **`refetchInterval: 15000` while the detail view is open** for the cross-user SLA. |
| `useNotifications` | `['notifications']` | 15s, polling every 30s | local mark-read mutations | Bell menu; polling keeps badge current without SSE. |
| `useAllowlist` | `['admin', 'allowlist']` | 60s | allowlist mutations | Admin-only. |

**Optimistic updates:**
- `updateTodo(status)` on a todo in `useMyTodos` / `useSprintDetail`: optimistic flip, rollback on `ok:false`.
- `postComment`: optimistic append to `useTodoComments`, rollback on failure.
- `markNotificationRead`: optimistic decrement of `unreadCount` and set `read_at` locally.

**Staleness on concurrent edit (FR alt flow):** When `updateTodo` returns `{ ok: true, data: { todo, stale: true } }`, the hook invalidates `useTodoDetail(id)` and surfaces a toast "This todo was updated by <user> — reload to see latest" using the server's `updated_at` and last actor.

### Cross-user cache freshness

TanStack Query invalidation is per-client — a server action cannot invalidate another user's cache. Cross-user visibility therefore depends on the **polling cadence** of each hook:

| Cross-user change | Dependent hook | SLA (worst-case latency for the other user to see it) |
|---|---|---|
| Member A assigns a todo to Member B | B's `useMyTodos` | 30s (hook stale time + window-focus refetch). |
| Member A posts a comment on a todo B watches | B's `useTodoComments`, `useTodoDetail` | 15s. |
| Member A flips a todo's status in the active sprint | Any other user's `useDashboardActiveSprint` | 30s. |
| `sweepDueSoonNotifications` creates a `due_soon` row | Assignee's `useNotifications` | 30s (bell polling interval). |
| Activity events produced by anyone | Any user's `useTeamActivity` | 30s. |

This is explicitly the accepted trade-off for v1 (single-org, small team, no SSE). Open Technical Q #2 in §15 tracks the SSE upgrade path. The PRD's "stale edit toast within 5s" SLA is therefore best-effort, not guaranteed — see §15.

### Local State

- **Todo form state:** react-hook-form + Zod resolver; kept local until submit, persisted across open/close of the side panel via a route search param (`?todoId=...`) so deep links work.
- **Filters on Backlog/My Todos/Sprint detail:** URL search params (assignee, status, priority) so browser back/forward round-trips correctly.
- **Dashboard section collapse (mobile first-goal-only):** `useState` with `localStorage` persistence keyed per sprint id so user preference sticks per session.
- **Comment composer:** local state, draft cleared after successful post.

Everything else is server state via TanStack Query.

---

## 5. Component Architecture

### Feature Directory Structure

```
src/
  app/                                # Next.js App Router
    (auth)/
      sign-in/
        page.tsx
    (app)/                            # authenticated shell
      layout.tsx                      # sidebar/topbar + bell + user menu
      dashboard/
        page.tsx
        loading.tsx
      sprints/
        page.tsx                      # Sprints list
        new/
          page.tsx
        [sprintId]/
          page.tsx                    # Sprint detail
          edit/
            page.tsx
      todos/
        (backlog)/
          page.tsx                    # Backlog view
        (mine)/
          page.tsx                    # My Todos view
        [todoId]/
          page.tsx                    # Full-page todo detail (mobile)
      admin/
        members/
          page.tsx
      api/
        auth/[...nextauth]/route.ts
        notifications/poll/route.ts
        admin/wau/route.ts
  server/
    actions/
      sprints.ts
      todos.ts
      comments.ts
      notifications.ts
      admin.ts
    db/
      client.ts                       # Prisma singleton
    auth/
      config.ts                       # Auth.js config
      allowlist.ts                    # callback logic
    jobs/
      cron.ts
      sweep-due-soon.ts
      rollup-wau.ts
      cleanup-notifications.ts
    services/
      activity.ts                     # helpers that write activity_events
      notifications.ts                # helpers that create notifications
    analytics/
      posthog.ts
  components/
    ui/                               # shadcn primitives
    layout/
      Sidebar.tsx
      Topbar.tsx
      BellMenu.tsx
    sprints/
      SprintCard.tsx
      SprintForm.tsx
      SprintGoalList.tsx
      SprintProgress.tsx
    todos/
      TodoForm.tsx
      TodoListItem.tsx
      TodoDetailPanel.tsx
      TodoStatusChip.tsx
      TodoPriorityChip.tsx
      MarkdownDoc.tsx                 # renders + edits markdown
    comments/
      CommentList.tsx
      CommentComposer.tsx
    dashboard/
      ActiveSprintCard.tsx
      MyTodosCard.tsx
      UpcomingDeadlinesCard.tsx
      TeamActivityCard.tsx
    empty-states/
      EmptyState.tsx
  lib/
    zod/
      todos.ts
      sprints.ts
      comments.ts
    hooks/
      useDashboard.ts                 # re-exports the 4 dashboard hooks
      useTodos.ts
      useSprints.ts
      useNotifications.ts
    markdown/
      sanitize.ts
      render.ts
    utils/
      date.ts
      url.ts
  types/
    domain.ts                         # see §7
    result.ts                         # Result<T,E>
  styles/
    globals.css
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
  e2e/
```

### Screen Specifications

For each screen below: route, auth requirement, server/client split, key design system components, states.

#### Sign-in (`/sign-in`)

- Route: `/sign-in`, public.
- Layout: centered card with app title, two buttons (Google, GitHub), small text "Your account must be added by an admin before you can sign in."
- shadcn: `Button`, `Card`.
- States:
  - Loading: button spinner during OAuth redirect.
  - Error (allowlist rejection): full-page card with message "Your account is not a member of this workspace. Contact an admin to request access." and `mailto:` to the admin.

#### Dashboard (`/dashboard`)

- Route: `/dashboard`, authenticated. Post-login default.
- Server component that fetches all four sections in parallel, then streams client-hydrated cards.
- Layout desktop ≥1024: CSS grid 2×2 (Active Sprint top-left, My Todos top-right, Upcoming Deadlines bottom-left, Team Activity bottom-right). Mobile <1024: single column stack in the order the PRD specifies.
- shadcn: `Card`, `Progress`, `Avatar`, `Badge`.
- States:
  - Loading: 4 skeleton `Card`s (each section's `loading.tsx` boundary renders for ≤800ms).
  - Empty: per PRD empty-state copy (Active Sprint → "No active sprint…" CTA; My Todos → "Nothing on your plate…"; etc.).
  - Error: inline per card with retry.

#### Sprints list (`/sprints`)

- Route: `/sprints`. Groups by `active` / `planned` / `completed` (FR-21). Button "New sprint" in header.
- shadcn: `Tabs` or stacked sections, `Button`, `DropdownMenu` (action menu per row).
- Empty: "No sprints yet. Plan your first sprint."
- Action menu: Edit, Make active, Complete, Delete (disabled with tooltip per FR-09).

#### Sprint detail (`/sprints/[sprintId]`)

- Route: `/sprints/[sprintId]`. Metadata at top; goal sections below; "Unassigned to goal" section last (FR-22).
- Buttons: Edit, Make active, Complete sprint.
- Desktop: goal sections all expanded; mobile: only first goal expanded (per platform table in PRD §6).
- shadcn: `Collapsible`, `Progress`, `Button`, `Badge`.
- States:
  - Empty goal: "No todos tagged to this goal yet."
  - Sprint not found: 404.

#### Sprint form (`/sprints/new`, `/sprints/[id]/edit`)

- Fields: name, start date, end date, dynamic goals list (add/remove).
- Validation: end ≥ start (inline error disabling Save — per error states in PRD §6); unique goal names.
- shadcn: `Input`, `DatePicker`, `Button`, `FormField`.

#### Backlog (`/todos`)

- Filters: assignee, status, priority (URL search params).
- shadcn: `DataTable` (or simple list), `Select`, `Badge`.
- Empty: "No backlog todos…"

#### My Todos (`/todos/mine`)

- Same filter pattern as Backlog, but pre-scoped to current user.
- Empty: "Nothing on your plate…"

#### Todo detail

- Desktop: slide-in side panel (Radix `Sheet`), width ~520px, opened via URL search param `?todoId=...` so it is linkable.
- Mobile: full page `/todos/[todoId]`.
- Sections: title + status/priority/assignee row, description, links list, markdown document viewer/editor, comments list, comment composer.
- Markdown: `MarkdownDoc` component with a tabbed "View / Edit" toggle; saves via `saveTodoDocument`.
- shadcn: `Sheet`, `Tabs`, `Textarea`, `Select`, `DatePicker`, `Button`.
- States:
  - Loading: title loads first; description/comments/markdown render as they arrive per PRD loading states.
  - Stale edit: toast "This todo was updated by <user> — reload to see latest".
  - Document too large: inline error "File too large (max 100KB)".

#### Admin Members (`/admin/members`)

- Two sections: current members (with Deactivate action) and allowlist (with Add + Remove).
- shadcn: `DataTable`, `Input`, `Button`.
- Guarded server-side: non-admin gets 403.

#### Bell menu (`/dashboard` header component)

- Dropdown from header. Shows last 20 notifications with unread count badge.
- Each row: actor avatar + message + relative time. Click → navigate to target and mark read.
- Empty: "You're all caught up."

### Reusable Components

| Component | Props | Behavior |
|-----------|-------|----------|
| `TodoStatusChip` | `{ status, onChange?, readOnly? }` | Renders colored chip; optional popover with status change; emits optimistic update. |
| `TodoPriorityChip` | `{ priority }` | Visual only (color + label). |
| `MarkdownDoc` | `{ content, onSave, readOnly?, maxBytes }` | Sanitized renderer (isomorphic-dompurify + react-markdown + remark-gfm); edit mode is a plain `Textarea` (no WYSIWYG in v1). Shows live byte count vs `maxBytes`. |
| `EmptyState` | `{ title, description, action? }` | Standardized empty placeholder used by every list view (required by PRD UX section). |
| `SprintProgress` | `{ done, total }` | Renders PRD per-goal/overall progress bar with `X / Y` label. |
| `CommentComposer` | `{ todoId }` | Optimistic append; 2000-char counter; disabled while submitting. |
| `CommentList` | `{ todoId }` | Renders comments newest-last with author + timestamp + "edited" marker (FR-19). Inline edit/delete only for the author. |
| `ActivityEventRow` | `{ event }` | Renders a single event for Team Activity with actor, verb, target link, relative time. |
| `UserAvatar` | `{ user, size }` | Avatar + fallback initials. |
| `ConfirmDialog` | `{ title, body, confirmLabel, onConfirm }` | Used for sprint activation clash, sprint goal delete with attached todos, sprint completion summary. |

---

## 6. Navigation

### New Routes

| Route | Screen | Auth | Params |
|-------|--------|------|--------|
| `/sign-in` | Sign-in | public | — |
| `/dashboard` | Dashboard | member | — |
| `/sprints` | Sprints list | member | — |
| `/sprints/new` | Sprint form (create) | member | — |
| `/sprints/[sprintId]` | Sprint detail | member | `sprintId` |
| `/sprints/[sprintId]/edit` | Sprint form (edit) | member | `sprintId` |
| `/todos` | Backlog | member | search: `assignee?`, `status?`, `priority?` |
| `/todos/mine` | My Todos | member | search: `status?`, `priority?` |
| `/todos/[todoId]` | Todo detail (mobile full page) | member | `todoId` |
| `/admin/members` | Admin members | admin | — |
| any route with `?todoId=...` | Desktop side panel | member | — |

### Navigation Flow

- Post-login default: `/dashboard`.
- Sidebar (desktop) / hamburger (mobile) links: Dashboard, Sprints, Backlog, My Todos, and Admin (admin role only). Header: "+ New todo" button (desktop) / FAB bottom-right (mobile) opens the todo form side panel. Bell icon next to user avatar in header.
- From Dashboard: clicking a todo opens the side panel (desktop) or navigates to `/todos/[id]` (mobile). Clicking the active sprint card navigates to `/sprints/[sprintId]`.
- From Sprint detail: clicking a todo opens the side panel.
- From any todo: clicking the sprint chip navigates to `/sprints/[sprintId]`; clicking the goal chip navigates to `/sprints/[sprintId]#goal-<goalId>`.
- Notification click: navigates to `/todos/[todoId]` and marks the notification read via `markNotificationRead`.
- "+ New todo" in header: opens the todo form side panel (desktop) / navigates to a new-todo page (mobile).
- Sign out: in the user menu (top-right dropdown), visible on every authenticated screen per FR-04.

---

## 7. Type Definitions

### Summary Table

| Type | Purpose | Consumers |
|------|---------|-----------|
| `UserRole` | Discriminator for user privilege. | Guards, admin screen. |
| `User` | Canonical user record. | Everywhere. |
| `SprintStatus` | `planned` / `active` / `completed`. | Sprint queries, UI badges. |
| `Sprint`, `SprintGoal` | Sprint aggregate. | Sprints/Sprint detail. |
| `TodoStatus`, `TodoPriority` | Todo enums. | Todo UI + filters. |
| `Todo`, `TodoLink`, `TodoDocument` | Todo aggregate. | Todos, dashboard. |
| `Comment` | Comment row. | Todo detail. |
| `ActivityEventKind`, `ActivityEvent` | Activity feed row. | Dashboard activity. |
| `NotificationKind`, `Notification` | Notification record. | Bell menu. |
| `AllowlistEntry` | Allowlist row. | Admin screen. |
| `DashboardData` | Aggregated dashboard payload. | Dashboard server component. |
| `Result<T, E>` | Discriminated action result. | All server actions. |
| `ServerActionError` | Error envelope. | All server actions. |
| `TodoFormState` | Discriminated form state (idle/submitting/error/success). | `TodoForm`. |
| `NotificationsState` | Discriminated UI state for bell. | `BellMenu`. |

### Type Code

```ts
// src/types/domain.ts

export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SprintStatus = 'planned' | 'active' | 'completed';

export interface SprintGoal {
  id: string;
  sprintId: string;
  name: string;
  position: number;
  createdAt: Date;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;     // ISO date (yyyy-mm-dd), not a Date — no timezone drift
  endDate: string;
  status: SprintStatus;
  createdByUserId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  goals: SprintGoal[];
}

export type TodoStatus = 'todo' | 'in_progress' | 'done';
export type TodoPriority = 'low' | 'medium' | 'high';

export interface TodoLink {
  id: string;
  todoId: string;
  url: string;
  label: string | null;
  position: number;
}

export interface TodoDocument {
  todoId: string;
  contentMarkdown: string;
  updatedAt: Date;
  updatedByUserId: string;
}

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  assigneeUserId: string | null;
  dueDate: string | null;       // ISO date
  sprintId: string | null;
  sprintGoalId: string | null;
  createdByUserId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  links: TodoLink[];
  document: TodoDocument | null;
}

export interface Comment {
  id: string;
  todoId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
}

export type ActivityEventKind =
  | 'todo_created'
  | 'todo_status_changed'    // includes completion as { to: 'done' } in payload
  | 'todo_assigned'
  | 'comment_posted'
  | 'sprint_created'
  | 'sprint_activated'
  | 'sprint_completed';

export interface ActivityEvent {
  id: string;
  actorUserId: string;
  kind: ActivityEventKind;
  targetTodoId: string | null;
  targetSprintId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export type NotificationKind = 'assigned' | 'due_soon' | 'comment_on_assigned';

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  targetTodoId: string;
  triggeredByUserId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface AllowlistEntry {
  id: string;
  email: string;
  addedByUserId: string;
  addedAt: Date;
}

export interface DashboardData {
  activeSprint:
    | null
    | {
        sprint: Sprint;
        goalProgress: Array<{ goalId: string | null; name: string; done: number; total: number }>;
        overall: { done: number; total: number };
      };
  myTodos: Todo[];            // capped at 10, sorted by dueDate asc nulls last
  upcomingDeadlines: Todo[];  // dueDate within 7d, status != done
  activity: ActivityEvent[];  // last 15
}

// Discriminated result used by every server action
export type Result<T, E = ServerActionError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Discriminated union on `code` so conflict variants can carry extra fields
// without `any` or `@ts-expect-error` gymnastics at call sites.
export type ServerActionError =
  | { code: 'active_sprint_conflict'; message: string; currentActiveSprintId: string }
  | { code: 'validation_failed'; message: string; field?: string }
  | {
      code:
        | 'unauthorized'
        | 'forbidden'
        | 'not_found'
        | 'conflict'
        | 'rate_limited'
        | 'document_too_large'
        | 'cannot_delete_sprint'
        | 'cannot_delete_last_admin'
        | 'internal_error';
      message: string;
    };

// UI-state discriminated union for the todo form
export type TodoFormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string; fieldErrors?: Record<string, string> }
  | { kind: 'success'; todoId: string };

// UI-state for the bell menu
export type NotificationsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: Notification[]; unreadCount: number };
```

Zod schemas mirror these interfaces one-to-one in `src/lib/zod/*.ts` and are the single source of truth for runtime validation; the TS types are either inferred from Zod (`z.infer<typeof X>`) or aligned manually where Prisma-generated types are preferred. Prisma's generated types are used internally in the server layer; they are mapped to these domain types at the action boundary so the client never sees internal Prisma shapes.

**Date vs string mapping.** Domain types use `Date` for timestamp columns (`timestamptz`) and **ISO date strings (`yyyy-mm-dd`) for calendar-date columns** (`sprints.start_date`, `sprints.end_date`, `todos.due_date`, `sprints.completedAt` stays `Date` because it is `timestamptz`). Prisma returns `date`-typed columns as JavaScript `Date` objects by default, which is the wrong shape — a single mapper helper `toIsoDate(d: Date | null): string | null` in `src/lib/utils/date.ts` is applied at every action boundary (server → client). There is **one** place callers do this conversion (the mapper), not per-caller ad-hoc. Enforced by a unit test that feeds a Prisma row fixture and asserts the mapped shape.

**PRD hyphen vs code underscore:** PRD §5 FR-11 displays statuses as `todo / in-progress / done`. The code's canonical wire + DB form is `todo | in_progress | done` (underscore). The UI renders the hyphenated label from a lookup in `src/lib/utils/labels.ts`. The Zod schema accepts only the underscore form; any code or API input using hyphens is a bug.

---

## 8. Analytics Implementation

Analytics events listed in PRD §8 are emitted to PostHog from a single `emitEvent(eventName, params)` helper in `src/server/analytics/posthog.ts`, called from the same server action that performs the mutation, inside the post-transaction callback so a failed DB write never emits a success event.

| Event | Trigger point | Where instrumented |
|-------|---------------|--------------------|
| `session_started` | Auth.js `signIn` callback, after allowlist admit and `sessions_log` write | `src/server/auth/config.ts` `events.signIn` |
| `sprint_created` | `createSprint` action, after txn commit | `src/server/actions/sprints.ts` |
| `sprint_activated` | `activateSprint` action | `src/server/actions/sprints.ts` |
| `sprint_completed` | `completeSprint` action (and the implicit completion inside `activateSprint` if swapping) | `src/server/actions/sprints.ts` |
| `todo_created` | `createTodo` action | `src/server/actions/todos.ts` |
| `todo_status_changed` | `updateTodo` when status field changed | `src/server/actions/todos.ts` |
| `todo_assigned` | `updateTodo`/`createTodo` when assignee set or changed | `src/server/actions/todos.ts` |
| `comment_posted` | `postComment` action | `src/server/actions/comments.ts` |
| `notification_opened` | `markNotificationRead` action (single read triggered by click) | `src/server/actions/notifications.ts` |
| `dashboard_viewed` | Client-side on Dashboard mount | `src/app/(app)/dashboard/page.tsx` (via a client hook using `posthog-js`) |

PostHog is initialized server-side with the project key and flushed per-request; client events use `posthog-js`. Event parameters mirror PRD §8 exactly. A middleware strips PII from params beyond `user_id`. `comment_length_bucket` is one of `s` (< 140), `m` (140-500), `l` (> 500).

---

## 9. Permissions & Security

### Access Policies

Enforced in a thin guard layer: every server action begins with:
1. `const session = await auth()` — rejects with `unauthorized` if no session.
2. `const user = await getUserById(session.user.id)` — rejects with `unauthorized` if `is_active=false`.
3. Ownership / role check per action (see matrix in §2).

Admin-only actions additionally check `user.role === 'admin'` and return `forbidden` otherwise.

Comment edit/delete check `comment.authorUserId === user.id`.

Sprint delete validates `status='planned'` and that no todos reference it (both in a single query).

Sprint activation runs in a serializable transaction that:
1. Locks the current active sprint (if any) with `SELECT … FOR UPDATE`.
2. Validates the caller's `acknowledgedCompletingId` matches.
3. Flips the old sprint to `completed`, the new one to `active`.
The partial unique index on `sprints(status)` WHERE `status='active'` provides a last-line guarantee.

### Client-Side Guards

- `AuthBoundary` component in `(app)/layout.tsx` redirects unauthenticated users to `/sign-in`.
- `AdminBoundary` component wraps `/admin/*` routes and returns 403 for non-admins.
- Optimistic UI flips are rolled back if the server returns `forbidden`, with a toast.
- OAuth buttons on `/sign-in` show a loading state while redirecting; the allowlist rejection is caught in the Auth.js callback and surfaced via `?error=not_allowlisted` search param read by the page.

### Auth.js Configuration Notes

- Providers: Google, GitHub.
- Adapter: Prisma adapter targeting `users`, `accounts`, `sessions`, `verification_tokens`.
- `signIn` callback: looks up `allowlist_entries` by email. If empty AND `users` table empty → bootstrap this user as `admin`. If allowlist contains the email (case-insensitive) → admit as `member`. Otherwise reject with reason `not_allowlisted`.
- `events.signIn`: writes `sessions_log`, updates `users.last_seen_at`, emits PostHog `session_started`.
- Session strategy: database (required for the Prisma adapter + the allowlist revocation flow — revoking an allowlist entry should eventually kick the user; a database session lets us deactivate cheaply).
- CSRF: Auth.js defaults.
- Cookies: `secure`, `httpOnly`, `SameSite=Lax`.

### Markdown Sanitization

- Rendered client and server via `isomorphic-dompurify` after `remark-gfm` parsing. No raw HTML allowed through.
- No JS execution. No remote resource fetch for images in v1 (images not required per Open Question 4; if admitted, they'd need an allowlist).
- Size validated at form layer (Zod) and at DB layer (CHECK). Both are load-bearing: client validation is UX, server is truth.

### Deferred to v1.1 (with interim mitigations)

Two security-hardening items are **deferred to v1.1** for this internal-team MVP. Full context, residual-risk language, and release gates in §15 Q13–Q14.

1. **OAuth token encryption at rest** in the Auth.js `accounts` table (`access_token`, `refresh_token`, `id_token`). v1 relies on managed-Postgres disk encryption + restricted credentials; v1.1 will add application-level AEAD keyed by `AUTH_SECRET`. **Release gate:** before admitting any user outside the founding ~15-person team, and no later than 2026-07-16.
2. **Session revocation on deactivation.** When an admin deactivates a user or removes an allowlist entry matching a current user, the live session cookie can still drive SSR reads until natural expiry. **Interim mitigation now:** Auth.js `session.maxAge = 24h` (bounds worst-case lag to 1 day). v1.1 will add Next middleware that re-checks `users.is_active` every request and deletes the Auth.js session row inside `deactivateUser`.

**Closed in v1 (not deferred):** URL-scheme allow-list on `todo_links.url` — Zod `.refine()` restricting to `http|https|mailto` + DB `CHECK`. See §2 `todo_links` and §15 Q15.

### Rate Limiting

Per-user sliding window on `postComment` (10/minute) and `saveTodoDocument` (10/minute), implemented as a **Postgres-backed counter** against the `rate_limit_buckets` table (see §2). Each rate-limited action inserts a `(user_id, action_key, event_at=now())` row, then runs a `SELECT count(*) FROM rate_limit_buckets WHERE user_id=? AND action_key=? AND event_at > now() - interval '60 seconds'`. If count exceeds the limit, the action returns `{ ok: false, error: { code: 'rate_limited' } }`. Chosen in place of an in-process token bucket because Vercel functions are stateless and would silently fail to rate-limit across invocations. Overkill for 15 users but cheap insurance against accidental client retry storms. The `cleanupStaleNotifications` job also deletes `rate_limit_buckets` rows older than 10 minutes so the table stays tight.

**Client UX on `rate_limited`:** the todo form and comment composer display a muted toast "You're doing that too fast — try again in a moment." The submit button is re-enabled; no form state is lost.

### Stale-Edit Handling (concurrent edits — PRD error state)

`updateTodo` accepts `expectedUpdatedAt`. When supplied and older than DB, the action still applies the patch (last-write-wins, per PRD), but returns `stale=true` plus the newer `updated_at` and the last updater's name. The client toast renders accordingly.

---

## 10. Performance Considerations

**Dashboard target:** first meaningful paint within 5s per PRD user story #8.

**Latency budget decomposition (worst-case cold-start path — Vercel):**

| Segment | Budget (p95) | Strategy |
|---|---|---|
| Cold-start function init + Prisma client warm | ≤ 1500ms | Use Vercel **Fluid Compute** (same function instance handles multiple concurrent requests, reducing cold-start frequency); pin the function region to the same region as Neon Postgres; keep the dashboard route on Node runtime (not edge) so Prisma works; set `PRISMA_QUERY_ENGINE_LIBRARY` in build so no native download on cold start. |
| Auth session read (DB session) | ≤ 150ms | Single indexed lookup on `sessions.session_token`. |
| Four dashboard queries in parallel | ≤ 500ms combined | One Prisma call per section, explicit `select`, no `include`-bombs. Indexes in §2. Run via `Promise.all`. |
| Server render + streaming | ≤ 300ms | Next.js streams each section independently; skeletons paint first. |
| Network + hydration | ≤ 1500ms | Typical for a modest React bundle; Markdown deps are lazy-loaded. |
| **Total p95 cold** | **≤ 3950ms** | Comfortably under 5s with margin. |
| **Total p95 warm** | **≤ 900ms** | Warm function + DB connection reuse. |

**Warm-cache-only path** (the PRD target) clocks under 1s and is verified in Phase 8 via Lighthouse CI + PostHog Web Vitals (LCP budget 2.5s, FCP 1.5s).

**Cold-start mitigation — order of preference:**
1. **Vercel Fluid Compute** (default; enable in `vercel.json`).
2. If cold starts still regress the budget in Phase 8 measurement, add a **keep-warm cron** (every 5 min, GET `/api/healthz`) as a last resort.
3. Moving the dashboard to edge runtime is **not** viable because Prisma's query engine is not edge-compatible.

**Query patterns to enforce:**
- Each dashboard query is a single Prisma call with explicit `select` (no `include`-bombs).
- Per-goal progress is one aggregate query using `GROUP BY sprint_goal_id` with `FILTER (WHERE status='done')`, not N+1 per goal.
- Sprint detail uses one query for sprint+goals and a second query for todos grouped by goal, joined client-side (cheap for our scale).
- The "last 15 activity events" query uses the `(created_at DESC)` index with `LIMIT 15`.

**Pagination:**
- `listActivity` supports cursor pagination (`before` = `created_at`) for the future "View all activity" page.
- `listTodos` returns all matching rows in v1 (total volume is tiny); introduce pagination only if a single view exceeds ~500 rows.
- Comments: no pagination in v1; expected < 50 per todo.

**Caching:**
- TanStack Query stale times as in §4.
- Server components use Next's `revalidateTag` after mutations rather than blanket `revalidatePath` to keep targeted invalidation cheap.
- Notifications poll every 30s; badge updates are optimistic.

**Bundle impact:**
- Markdown stack (`react-markdown`, `remark-gfm`, `isomorphic-dompurify`) is lazy-loaded via dynamic import when the todo detail's markdown tab is first opened — keeps initial bundle lean.
- shadcn components are copy-paste primitives; no heavy component library to tree-shake around.

**Database size:**
- Markdown docs at 100KB × ~hundreds of todos = single-digit MB. Inline text is fine.
- Activity events are unbounded; a v1.1 archival policy (delete > 1 year) should be scheduled but not required for MVP.

**Connections:**
- Prisma with one pooled client on a small pool (e.g., 10). Hosted Postgres handles this trivially.

---

## 11. Migration & Deployment

**Migrations:**
- `prisma/migrations/20260416_init/` creates all tables, indexes, and triggers. Because Prisma's declarative schema cannot express some of what the spec requires, the init migration **must include raw SQL steps** for:
  - `CREATE UNIQUE INDEX sprints_one_active_idx ON sprints (status) WHERE status = 'active';` (the partial unique enforcing "at most one active sprint" — Prisma's `@@unique([status])` would not produce this).
  - `CREATE UNIQUE INDEX notifications_due_soon_unique ON notifications (user_id, target_todo_id, kind) WHERE kind = 'due_soon';` (partial unique for dedup).
  - `CREATE TRIGGER trg_todo_goal_in_sprint` (cross-row integrity).
  - `CREATE OR REPLACE FUNCTION set_updated_at()` + `CREATE TRIGGER trg_set_updated_at_<table>` for each table with `updated_at`.
  - `ON DELETE RESTRICT` on `todos.sprint_id` and `todos.sprint_goal_id` (Prisma's `onDelete: Restrict` directive should emit this, but the integration test gate verifies via `pg_constraint`).
- A CI integration test asserts each of the above exists after `prisma migrate deploy` by querying `pg_indexes` / `pg_trigger` / `pg_constraint`.
- Subsequent migrations generated via `prisma migrate dev` during development; applied in CI via `prisma migrate deploy` on deploy.
- All migrations are forward-only; down migrations are not emitted. Rollback is by forward-fix (see below).

**Seed data:**
- A seed script inserts no users (first OAuth signup bootstraps the admin). Optionally, in dev, seeds a demo sprint with three goals and a handful of todos via `prisma/seed.ts`, gated behind `NODE_ENV !== 'production'`.

**Environment variables (required):**
- `DATABASE_URL`, `DIRECT_URL` (for migrations)
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `AUTH_URL` (v5; formerly `NEXTAUTH_URL`)
- `POSTHOG_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- `APP_BASE_URL`
- `ORG_TIMEZONE` (IANA tz name; default `UTC`). Governs calendar-date semantics for sprint dates and the due-soon window — see §2.
- `CRON_SECRET` (shared secret Vercel Cron sends as a header; `/api/cron/*` handlers reject without it).

**Feature flag / rollout:**
- No feature flag. Single-step launch per PRD §9. The primary gate is the allowlist: before go-live, the admin is onboarded, adds 2–3 emails for smoke test, then adds the rest on kickoff day.

**Deployment topology (committed):**

- **Platform:** Vercel (serverless Node runtime for the app + Vercel Cron for jobs). Fluid Compute enabled. Function region pinned to the same region as the Neon Postgres instance (default `us-east-1`).
- **Database:** Neon (managed Postgres). PgBouncer-compatible pooled URL used for `DATABASE_URL`; direct URL used for `DIRECT_URL` (migrations only).
- **Cron:** `vercel.json` declares three cron entries hitting `/api/cron/sweep-due-soon` (every 15 min), `/api/cron/rollup-wau` (hourly), `/api/cron/cleanup` (daily 03:00 UTC). Each handler checks `request.headers.get('x-vercel-cron-signature')` or an equivalent header against `CRON_SECRET`.
- There is no long-running process; there is no `node-cron`; there is no in-process rate limiter. All of these are absent by design.

**Deployment order for initial launch:**
1. Provision managed Postgres; set env vars.
2. Run `prisma migrate deploy` from CI.
3. Deploy the Next app.
4. Admin (first signup) signs in — bootstrap path creates the admin row.
5. Admin adds allowlist emails.
6. Smoke test with 2–3 users for 3 days.
7. Kickoff day onboarding.

**Rollback plan:**
- Code rollback: redeploy previous commit (Vercel instant rollback, or `git revert` + redeploy on Fly/Render).
- Schema rollback: any migration that touches existing columns must ship a two-phase change (add nullable column → backfill → enforce) so a single-commit revert doesn't break the prior app version. For the initial migration, rollback = drop DB (acceptable pre-launch).
- Data rollback: daily Postgres snapshot from the managed provider; restore to a point-in-time in a disaster.

**Observability:**
- Structured logs via `pino` with request id, user id, action name, duration.
- Error reporting via Sentry (Node + browser SDKs).
- Uptime ping: external health check on `/api/healthz`.

---

## 12. Implementation Phases

Each phase is independently deployable and leaves the app in a usable state.

**Phase 0 — Repo bootstrap (~1 day).** Initialize Next app, TypeScript, Tailwind, shadcn, Prisma, Auth.js scaffolding, CI (lint/typecheck/test), Vercel + Postgres wiring, Sentry, PostHog, Playwright harness, Testcontainers-based integration harness. No user-facing features yet. Gate: CI green on `main`.

**Phase 1 — Auth + Admin allowlist (FR-01..FR-04).** Sign-in page, Google + GitHub OAuth, first-user bootstrap, allowlist table and Admin Members screen, sign-out, `sessions_log`. Gate: an admin can sign in, add an email, that email can sign in, non-allowlisted email is rejected with the PRD copy.

**Phase 2 — Sprints CRUD (FR-05..FR-10).** Sprint list, detail, create/edit form, activation flow with confirmation, completion flow with totals. No todo linkage yet. Gate: all sprint user stories in PRD §4 #2–3, 12 pass as manual QA.

**Phase 3 — Todos core (FR-11..FR-17) + Backlog + My Todos views (FR-23, FR-24).** Todo CRUD, links, markdown document, filters, sprint/goal attachment rules, status transitions, completion timestamps. Gate: any team member can create, edit, and complete a todo end-to-end; backlog and my-todos views list correctly.

**Phase 4 — Comments (FR-18, FR-19) + Activity (FR-20 Team Activity).** Comments composer, edit/delete by author, `activity_events` writes for all event kinds, Team Activity card data. Gate: comment flow works; activity feed populates on every qualifying action.

**Phase 5 — Dashboard (FR-20 all sections).** Active Sprint Overview with per-goal progress aggregates, My Todos, Upcoming Deadlines, layout responsive per PRD §6 table. Empty and loading states. The authenticated layout's bell icon is scaffolded as a **stub with a zero badge and "You're all caught up." empty state** in Phase 1; Phase 6 wires it to real data. Gate: dashboard renders all four sections in desktop grid and mobile stack correctly; bell icon is visible but inert.

**Phase 6 — Notifications (FR-25..FR-27).** Notifications table, bell menu, assigned + comment-on-assigned synchronous creation, due-soon cron job (Vercel Cron endpoint). Gate: assignee sees "assigned" notification immediately; due-soon fires within 15 minutes of the window opening; click navigates and marks read.

**Phase 7 — Analytics + WAU admin view (FR-28, PRD §8).** PostHog wiring for all events, admin WAU view. Gate: all events fire once per action as specified; WAU admin view renders.

**Phase 8 — Polish and launch prep.** Accessibility audit on all shadcn-derived components (WCAG AA), error boundary coverage, empty-state sweep, perf check against the 5-second dashboard target, responsive review at 320px, 768px, 1024px, 1440px viewports. Kickoff demo recording. Gate: internal smoke test (PRD §9 step 1) passes.

---

## 13. Test Strategy

### Mapping to PRD Success Criteria (PRD §8)

| PRD Success Metric | Target | Verification Method | Phase |
|--------------------|--------|---------------------|-------|
| WAU / Total Org Members | ≥ 80% by week 4 | PostHog dashboard + admin WAU view (FR-28); manual weekly rollup check | Phase 7 (instrumentation), Post-launch (measurement) |
| Sprints created per 2-week period | ≥ 1 | PostHog `sprint_created` event count | Phase 7 |
| Active-sprint todos tagged to a goal | ≥ 60% | PostHog cohort: `todo_created` with `has_sprint=true` AND `has_goal=true` | Phase 7 |
| Median todos created per WAU per week | ≥ 5 | PostHog `todo_created` grouped by `user_id` weekly | Phase 7 |
| Dashboard situational awareness | Within 5s of open (PRD user story #8) | Lighthouse / Web Vitals LCP budget 2.5s, FCP 1.5s; automated Playwright perf step + real user monitoring via PostHog Web Vitals | Phase 8 |

### Mapping to Functional Requirements

| FR ID | Test Description | Type | Preconditions |
|-------|------------------|------|---------------|
| FR-01 | Google and GitHub buttons initiate correct OAuth flows; no email/password form exists | e2e + unit (config) | Auth providers configured in test env |
| FR-02 | First signup (empty DB) becomes admin; second new-email signup is rejected with "request access" copy | integration (Auth.js `signIn` callback) | Empty `users` and `allowlist_entries` |
| FR-03 | Admin can add and remove allowlist entries; non-admin cannot | integration | Admin user and member user seeded |
| FR-04 | Sign-out menu is present on every authenticated screen and ends session | e2e | Signed-in user |
| FR-05 | Sprint created with name, start, end, goals; end ≥ start enforced; goal names unique per sprint | integration | Authenticated member |
| FR-06 | Sprint status enum is exactly `planned`/`active`/`completed` | unit (Zod schema) + integration (DB CHECK) | — |
| FR-07 | Attempting to activate a second sprint without ack is rejected; with ack the prior is completed | integration | Two sprints in DB, one `active` |
| FR-08 | Editing sprint in any status works; deleting a goal with attached todos prompts detach-or-cancel | integration + e2e | Sprint with goal and attached todos |
| FR-09 | Deleting `active` or `completed` sprint rejected; `planned` with no todos allowed | integration | Three sprints in each status |
| FR-10 | On `completed`, todos retain sprint/goal linkage (read-only) | integration | Sprint with attached todos |
| FR-11 | Todo validates title ≤ 140, description ≤ 4000, status/priority enums, assignee-is-member, due-date-date, document ≤ 100KB | unit (Zod) + integration | Seeded user |
| FR-12 | Todo can be attached to a sprint and one goal; goal must belong to that sprint | integration (trigger test) | Sprint with goals |
| FR-13 | Todo with `sprintId=null` appears in Backlog view | integration + e2e | One backlog todo |
| FR-14 | Any member can edit, reassign, delete any todo | integration | Two members; one's todo |
| FR-15 | `done` sets `completed_at`; reopen clears it | integration | Todo in `todo` status |
| FR-16 | Detaching todo from sprint clears `sprint_goal_id` | integration | Todo with sprint + goal |
| FR-17 | Markdown renders with GFM; tables, strikethrough, task lists render; raw HTML sanitized | unit + e2e | Todo with markdown body |
| FR-18 | Comment body ≤ 2000 chars; appears newest-last with author + timestamp | integration + e2e | Todo |
| FR-19 | Only author can edit/delete own comment; edit sets `edited_at` and UI shows "edited" | integration + e2e | Two users; one's comment |
| FR-20 | Dashboard shows all four sections with correct data; per-goal progress aggregates are correct | integration (aggregate query) + e2e (visual sections present) | Seeded active sprint + todos |
| FR-21 | Sprints list groups by status, sorts start_date desc within each group | integration + e2e | Multiple sprints |
| FR-22 | Sprint detail groups todos by goal; "Unassigned to goal" section contains todos with sprint but no goal | integration + e2e | Sprint with mixed todos |
| FR-23 | Backlog view lists sprintId=null todos; assignee/status/priority filters reduce results correctly | integration + e2e | Backlog todos with varied fields |
| FR-24 | My Todos view shows todos assigned to current user across sprints and backlog | integration + e2e | Multiple assignees |
| FR-25 | Notification created when assigned; when due within 24h; when commented on as assignee | integration (a) immediate, (b) cron, (c) immediate | Various preconditions per kind |
| FR-26 | Bell menu shows unread count and last 20; clicking navigates and marks read | e2e | User with notifications |
| FR-27 | No email / push / Slack integration is hit in any code path | unit (grep for forbidden imports) | — |
| FR-28 | `sessions_log` written on each sign-in; WAU count query matches manual calculation | integration | Seeded sessions across users |

### Unit Tests

- **Zod schemas (`src/lib/zod/*`):** boundary validation for titles, description length, URL validity, markdown size, sprint date ordering, goal name uniqueness.
- **Date utilities (`src/lib/utils/date.ts`):** "within 7 days", "within 24 hours", timezone-safe comparison against ISO dates.
- **Markdown sanitizer (`src/lib/markdown/sanitize.ts`):** strips `<script>`, `javascript:` URLs, `onerror=` attrs; preserves GFM tables.
- **Server action result mappers:** error code mapping, field error formatting.
- **Status transition rules for todos:** `done` → sets `completed_at`; non-`done` → clears it.
- **Notification dedupe logic helper:** produces the right `(user_id, target_todo_id, kind)` tuple for the partial unique index.

### Test Fixtures

All fixtures live in `tests/support/fixtures.ts`. The contract below is load-bearing — tests rely on these defaults — so the fixture file itself has a unit test asserting them. Callers override only the fields they care about.

| Fixture | Default value | Override example |
|---|---|---|
| `seedTodo(overrides?)` | `{ title: 'Test todo', description: null, status: 'todo', priority: 'medium', assigneeUserId: null, dueDate: null, sprintId: null, sprintGoalId: null, createdByUserId: <some seeded member> }` | `seedTodo({ assigneeUserId: user.id })` |
| `seedSprint(overrides?)` | `{ name: 'Test sprint', startDate: today ISO, endDate: today+14 ISO, status: 'planned', withGoals: [] }` | `seedSprint({ status: 'active', withGoals: ['G1'] })` |
| `seedGoalWithTodos({ todoCount })` | `{ sprintStatus: 'planned', goalName: 'G', todoCount }` | `seedGoalWithTodos({ todoCount: 3 })` |
| `seedActivity(overrides?)` | `{ actorUserId, kind: 'todo_created', targetTodoId: null, targetSprintId: null, payload: null, createdAt: now() }` | timestamps should be spaced by `+1ms` per row if the test asserts strict ordering |
| `seedNotification(overrides?)` | `{ userId, kind: 'assigned', targetTodoId: <new>, readAt: null }` | |
| `seedSessionLog({ userId, createdAt })` | No defaults for `userId`; `createdAt` defaults to `now()` | |
| `createMember(email?)` / `createAdmin(email?)` | Random email if not supplied; `isActive: true` | |
| `deactivateUser(user)` | helper that sets `is_active=false` | used in assignee-deactivated tests |

`addDaysISO(n)`, `addHoursISO(n)`, `daysAgo(n)` helpers return ISO strings relative to `now()`. A test that depends on a specific clock pins `vi.useFakeTimers()`.

### Integration Tests

Run against a real Postgres (Testcontainers). A fixture seeds a minimal org: one admin, two members, empty sprints.

- **Auth bootstrap:** empty DB + first signup → user created as admin; second signup from a different email → rejected; admin adds the email → that email's signup → member.
- **Sprint activation swap:** two sprints, one active; `activateSprint(newId)` without ack → rejects with `active_sprint_conflict`; with ack → old=completed, new=active, `activity_events` contains both `sprint_completed` and `sprint_activated`.
- **Sprint delete guards:** deleting active/completed → rejected; deleting planned with attached todos → rejected; deleting planned with none → succeeds.
- **Todo goal integrity trigger:** insert/update violating cross-row rule (goal belongs to different sprint) → trigger raises.
- **Todo completion timestamp:** update to `done` → `completed_at` set; update back to `in_progress` → `completed_at=null`.
- **Comment authorship:** user A creates comment, user B edit/delete → rejected `forbidden`.
- **Notification creation:** assignment → row inserted synchronously; due-soon sweep over a seeded todo with due-date in 6h → row inserted; second run of sweep on same state → no duplicate (partial unique index holds).
- **Dashboard aggregates:** seeded sprint with 3 goals and varied todo statuses → `getDashboardData.activeSprint.goalProgress` numbers match hand-computed expected.
- **Allowlist admin RBAC:** member calls `addAllowlistEmail` → `forbidden`; admin calls → succeeds.
- **Stale edit detection:** two `updateTodo` calls with the same `expectedUpdatedAt` → second returns `stale=true`.
- **Sprint `status='active'` uniqueness:** raw SQL that tries to insert a second `active` row → fails on partial unique index.

### End-to-End Tests (Playwright)

Run in CI against a Dockerized full stack (app + Postgres). Each test seeds DB via API or direct Prisma.

- **E2E-1 — Daily team-member flow (maps to PRD §6 happy path and user stories #1, #4, #5, #7, #8, #10):** Member signs in with Google (OAuth mocked), lands on Dashboard, sees four sections, clicks a todo in My Todos, flips status `todo`→`in_progress`, sees activity appear, closes panel, sees My Todos count update.
- **E2E-2 — Sprint lead planning flow (user stories #2, #3, #11):** Lead creates sprint with 2 goals, activates it (confirming completion of prior if present), opens sprint detail, sees goal sections with todos from seed, sees per-goal progress bars.
- **E2E-3 — Sprint close flow (user story #12):** On sprint end date, lead clicks Complete sprint, sees totals dialog ("X of Y todos done, Z goals fully completed"), confirms, sprint moves to Completed section of list.
- **E2E-4 — Backlog todo creation (user story #6):** From header, create todo with no sprint; appears in Backlog with correct filters.
- **E2E-5 — Comments and assignee notification (user stories #9, #10):** Member A creates todo assigned to Member B. B sees `assigned` notification in bell. A posts comment on the todo. B sees `comment_on_assigned` notification.
- **E2E-6 — Markdown doc (FR-17):** Create todo, attach markdown with GFM table + checklist + link, save, reopen, verify rendered. Oversize doc (> 100KB) → inline error.
- **E2E-7 — Responsive layout:** Dashboard at 1440×900 shows 2×2 grid; at 375×812 shows single column in PRD-specified order; todo detail is side panel at ≥1024, full page at <1024.
- **E2E-8 — Admin flow (FR-02, FR-03):** Admin adds email, that email signs in → admitted; admin removes email → subsequent sign-in attempt rejected.

### Edge Case & Error Path Tests

All from PRD §6 (Error States / Empty States / Loading States):

- Sign-in rejected non-allowlisted email → PRD copy renders.
- Sprint form with start > end → Save disabled + inline error (unit on form, e2e on screen).
- Delete sprint goal with attached todos → modal with detach-or-cancel (e2e).
- Two users editing same todo simultaneously → second gets stale toast within 5s (integration simulates via two server actions; e2e optional).
- Markdown > 100KB → inline error (unit on Zod, e2e on form).
- Network failure on save → retry toast with form state preserved (e2e with intercepted fetch).
- Empty states for: Active Sprint, My Todos, Upcoming Deadlines, Team Activity, Backlog, Notifications (e2e walkthroughs on a fresh org).
- Loading state: Dashboard shows skeletons ≤800ms (Playwright asserts skeleton visible then replaced).
- Concurrent sprint activation: two activate requests racing on two sprints → exactly one wins (integration; partial unique index enforces).

### Performance & Load Tests

- Dashboard server-side render budget: 500ms p95 under a seeded workload of 5 sprints × 30 todos each × 50 activity events; measured in an integration test with a timer.
- Front-end performance: Lighthouse CI budget LCP < 2.5s, TTI < 3s on dashboard.
- No formal load test required for ~15 users; a smoke script that logs 15 concurrent sessions creating 1 todo each should complete in < 5s total.

---

## 13.5 Test Skeletons

Each skeleton maps to a row in the FR mapping table. Vitest for unit + integration, Playwright for e2e. Every FR has at least one skeleton.

```ts
// ==============================
// Auth & allowlist
// ==============================
import { describe, test, expect, beforeEach } from 'vitest';
import { handleSignInCallback } from '@/server/auth/allowlist';
import { db } from '@/server/db/client';
import { createMember, createAdmin, seedAllowlist, resetDb } from '@/tests/support/fixtures';

describe('FR-01: Google + GitHub are the only sign-in options', () => {
  test('auth config exposes exactly google and github providers', async () => {
    const { authConfig } = await import('@/server/auth/config');
    const ids = authConfig.providers.map((p: any) => p.id).sort();
    expect(ids).toEqual(['github', 'google']);
  });
});

describe('FR-02: first signup becomes admin; others require allowlist', () => {
  beforeEach(async () => { await resetDb(); });

  test('first signup on empty DB is admitted as admin', async () => {
    // setup: empty users and allowlist_entries
    const result = await handleSignInCallback({
      email: 'founder@example.com',
      displayName: 'Founder',
      avatarUrl: null,
      provider: 'google',
    });

    expect(result.ok).toBe(true);
    const user = await db.user.findUnique({ where: { email: 'founder@example.com' } });
    expect(user?.role).toBe('admin');
  });

  test('second new-email signup without allowlist is rejected', async () => {
    // setup: one admin already exists, allowlist empty
    await createAdmin('founder@example.com');

    const result = await handleSignInCallback({
      email: 'stranger@example.com',
      displayName: 'Stranger',
      avatarUrl: null,
      provider: 'github',
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('not_allowlisted');
  });
});

describe('FR-03: only admins can manage the allowlist', () => {
  test('admin can add an allowlist email', async () => {
    // setup: admin user present
    const admin = await createAdmin('admin@example.com');
    const result = await addAllowlistEmail({ email: 'new@example.com' }, { actor: admin });
    expect(result.ok).toBe(true);
  });

  test('member cannot add an allowlist email', async () => {
    const member = await createMember('m@example.com');
    const result = await addAllowlistEmail({ email: 'x@example.com' }, { actor: member });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('forbidden');
  });
});

describe('FR-04: sign-out present on every authenticated screen', () => {
  test('sign-out link is visible in the user menu on dashboard', async ({ page }) => {
    // setup: signed-in member lands on /dashboard (Playwright fixture)
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /account menu/i }).click();
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();
  });
});

// ==============================
// Sprints
// ==============================
describe('FR-05: sprint validation', () => {
  test('end date before start date is rejected', async () => {
    const result = await createSprint(
      { name: 'S1', startDate: '2026-05-10', endDate: '2026-05-01', goals: ['A'] },
      { actor: await createMember() },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.field).toBe('endDate');
  });

  test('duplicate goal names in one sprint are rejected', async () => {
    const result = await createSprint(
      { name: 'S2', startDate: '2026-05-01', endDate: '2026-05-14', goals: ['A', 'a'] },
      { actor: await createMember() },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('validation_failed');
  });
});

describe('FR-06: sprint status enum', () => {
  test('Zod schema accepts only planned/active/completed', async () => {
    const { sprintStatusSchema } = await import('@/lib/zod/sprints');
    expect(sprintStatusSchema.safeParse('planned').success).toBe(true);
    expect(sprintStatusSchema.safeParse('active').success).toBe(true);
    expect(sprintStatusSchema.safeParse('completed').success).toBe(true);
    expect(sprintStatusSchema.safeParse('archived').success).toBe(false);
  });
});

describe('FR-07: at most one active sprint', () => {
  test('activating a second sprint without ack returns active_sprint_conflict', async () => {
    // setup: two sprints, one already active
    const user = await createMember();
    const active = await seedSprint({ status: 'active' });
    const planned = await seedSprint({ status: 'planned' });

    const result = await activateSprint({ id: planned.id }, { actor: user });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('active_sprint_conflict');
  });

  test('activating with correct ack flips previous to completed', async () => {
    const user = await createMember();
    const active = await seedSprint({ status: 'active' });
    const planned = await seedSprint({ status: 'planned' });

    const result = await activateSprint(
      { id: planned.id, acknowledgedCompletingId: active.id },
      { actor: user },
    );
    expect(result.ok).toBe(true);
    const after = await db.sprint.findMany({ where: { id: { in: [active.id, planned.id] } } });
    const byId = Object.fromEntries(after.map((s) => [s.id, s]));
    expect(byId[active.id].status).toBe('completed');
    expect(byId[active.id].completedAt).toBeInstanceOf(Date); // §3: activateSprint must set completed_at on the swapped-out sprint
    expect(byId[planned.id].status).toBe('active');
  });

  test('conflict response includes the current active sprint id for client re-ack', async () => {
    const user = await createMember();
    const currentActive = await seedSprint({ status: 'active' });
    const planned = await seedSprint({ status: 'planned' });

    // caller ack'd an id that is not actually the current active sprint
    const staleId = (await seedSprint({ status: 'completed' })).id;
    const result = await activateSprint(
      { id: planned.id, acknowledgedCompletingId: staleId },
      { actor: user },
    );
    expect(result.ok).toBe(false);
    if (result.ok === false && result.error.code === 'active_sprint_conflict') {
      expect(result.error.currentActiveSprintId).toBe(currentActive.id);
    } else {
      throw new Error('expected active_sprint_conflict error');
    }
  });

  test('DB-level partial unique index rejects a raw second active sprint insert', async () => {
    await seedSprint({ status: 'active' });
    // bypass application guards and try the direct insert
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO sprints (id, name, start_date, end_date, status, created_by_user_id)
         VALUES (gen_random_uuid(), 'X', current_date, current_date, 'active', (SELECT id FROM users LIMIT 1))`,
      ),
    ).rejects.toThrow(/unique/i);
  });
});

describe('FR-08: deleting a goal with attached todos prompts detach-or-cancel', () => {
  test('deleteSprintGoal with strategy=cancel returns cannot-delete unless detached', async () => {
    const goal = await seedGoalWithTodos({ todoCount: 2 });
    const res = await deleteSprintGoal({ goalId: goal.id, strategy: 'cancel' }, { actor: await createMember() });
    expect(res.ok).toBe(false);
  });

  test('deleteSprintGoal with strategy=detach_todos clears sprint_goal_id and deletes goal', async () => {
    const goal = await seedGoalWithTodos({ todoCount: 2 });
    const res = await deleteSprintGoal({ goalId: goal.id, strategy: 'detach_todos' }, { actor: await createMember() });
    expect(res.ok).toBe(true);
    const todos = await db.todo.findMany({ where: { sprintGoalId: goal.id } });
    expect(todos).toHaveLength(0);
  });
});

describe('FR-09: delete only planned sprints with no todos', () => {
  test('cannot delete active sprint', async () => {
    const s = await seedSprint({ status: 'active' });
    const res = await deleteSprint({ id: s.id }, { actor: await createMember() });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('cannot_delete_sprint');
  });

  test('cannot delete planned sprint with attached todos', async () => {
    const s = await seedSprint({ status: 'planned' });
    await seedTodo({ sprintId: s.id });
    const res = await deleteSprint({ id: s.id }, { actor: await createMember() });
    expect(res.ok).toBe(false);
  });

  test('can delete planned sprint with no todos', async () => {
    const s = await seedSprint({ status: 'planned' });
    const res = await deleteSprint({ id: s.id }, { actor: await createMember() });
    expect(res.ok).toBe(true);
  });
});

describe('FR-10: completed sprint retains todo linkage', () => {
  test('after completeSprint, attached todos still have sprintId and goal', async () => {
    const s = await seedSprint({ status: 'active', withGoals: ['G1'] });
    const todo = await seedTodo({ sprintId: s.id, sprintGoalId: s.goals[0].id });

    await completeSprint({ id: s.id }, { actor: await createMember() });

    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.sprintId).toBe(s.id);
    expect(after?.sprintGoalId).toBe(s.goals[0].id);
  });
});

// ==============================
// Todos
// ==============================
describe('FR-11: todo field validation', () => {
  test('title over 140 chars rejected', async () => {
    const res = await createTodo({ title: 'x'.repeat(141) }, { actor: await createMember() });
    expect(res.ok).toBe(false);
    expect(res.error?.field).toBe('title');
  });

  test('markdown document > 100KB rejected', async () => {
    const todo = await seedTodo();
    const big = 'a'.repeat(100 * 1024 + 1);
    const res = await saveTodoDocument({ todoId: todo.id, contentMarkdown: big }, { actor: await createMember() });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('document_too_large');
  });

  test('assignee must be an existing, active org member', async () => {
    // non-existent user id rejected
    const bogus = '00000000-0000-0000-0000-000000000000';
    const r1 = await createTodo(
      { title: 'T', assigneeUserId: bogus },
      { actor: await createMember() },
    );
    expect(r1.ok).toBe(false);
    expect(r1.error?.field).toBe('assigneeUserId');

    // deactivated user rejected
    const inactive = await createMember('gone@x');
    await deactivateUser(inactive);
    const r2 = await createTodo(
      { title: 'T2', assigneeUserId: inactive.id },
      { actor: await createMember() },
    );
    expect(r2.ok).toBe(false);
    expect(r2.error?.field).toBe('assigneeUserId');
  });
});

describe('FR-11 PATCH semantics: key-absent vs null for nullable fields', () => {
  test('omitting assigneeUserId leaves the existing assignee unchanged', async () => {
    const a = await createMember('a@x');
    const todo = await seedTodo({ assigneeUserId: a.id });
    const res = await updateTodo(
      { id: todo.id, title: 'renamed' }, // no assigneeUserId key
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.assigneeUserId).toBe(a.id);
  });

  test('sending assigneeUserId: null clears the assignee', async () => {
    const a = await createMember('a2@x');
    const todo = await seedTodo({ assigneeUserId: a.id });
    const res = await updateTodo(
      { id: todo.id, assigneeUserId: null },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.assigneeUserId).toBeNull();
  });
});

describe('FR-12: todo sprint/goal integrity', () => {
  test('attaching a goal from a different sprint is rejected', async () => {
    const s1 = await seedSprint({ withGoals: ['A'] });
    const s2 = await seedSprint({ withGoals: ['B'] });
    const todo = await seedTodo({ sprintId: s1.id });

    const res = await updateTodo(
      { id: todo.id, sprintGoalId: s2.goals[0].id },
      { actor: await createMember() },
    );
    expect(res.ok).toBe(false);
  });
});

describe('FR-13: backlog is sprintId=null', () => {
  test('backlog list returns only unattached todos', async () => {
    const s = await seedSprint();
    await seedTodo({ sprintId: s.id });
    const backlogTodo = await seedTodo();
    const res = await listTodos({ filter: { sprintScope: { kind: 'backlog' } } }, { actor: await createMember() });
    expect(res.ok).toBe(true);
    expect(res.data.map((t) => t.id)).toEqual([backlogTodo.id]);
  });
});

describe('FR-14: any member can edit/delete any todo', () => {
  test("member can delete another member's todo", async () => {
    const owner = await createMember('o@example.com');
    const other = await createMember('x@example.com');
    const todo = await seedTodo({ createdByUserId: owner.id });
    const res = await deleteTodo({ id: todo.id }, { actor: other });
    expect(res.ok).toBe(true);
  });
});

describe('FR-15: completion timestamp', () => {
  test('marking done sets completed_at', async () => {
    const todo = await seedTodo({ status: 'todo' });
    const res = await updateTodo({ id: todo.id, status: 'done' }, { actor: await createMember() });
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.completedAt).toBeInstanceOf(Date);
  });

  test('reopening clears completed_at', async () => {
    const todo = await seedTodo({ status: 'done', completedAt: new Date() });
    const res = await updateTodo({ id: todo.id, status: 'in_progress' }, { actor: await createMember() });
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.completedAt).toBeNull();
  });
});

describe('FR-16: detaching sprint clears goal', () => {
  test('setting sprintId=null clears sprintGoalId', async () => {
    const s = await seedSprint({ withGoals: ['G'] });
    const todo = await seedTodo({ sprintId: s.id, sprintGoalId: s.goals[0].id });
    const res = await updateTodo({ id: todo.id, sprintId: null }, { actor: await createMember() });
    expect(res.ok).toBe(true);
    const after = await db.todo.findUnique({ where: { id: todo.id } });
    expect(after?.sprintGoalId).toBeNull();
  });
});

describe('FR-17: markdown rendering + sanitization', () => {
  test('raw <script> is stripped', () => {
    const html = renderMarkdown('# hi <script>alert(1)</script>');
    expect(html).not.toMatch(/<script>/i);
  });

  test('GFM table renders as <table>', () => {
    const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toMatch(/<table/);
  });

  test.each([
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<iframe src="http://evil.example"></iframe>',
    '<svg onload=alert(1)>',
  ])('sanitizer strips %s', (payload) => {
    const html = renderMarkdown(`before ${payload} after`);
    expect(html).not.toMatch(/onerror|onload|javascript:|<iframe|<script/i);
  });
});

describe('FR-11/Security: todo_links.url scheme restriction', () => {
  test.each(['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd'])(
    'rejects %s',
    async (url) => {
      const todo = await seedTodo();
      const res = await addTodoLink({ todoId: todo.id, url }, { actor: await createMember() });
      expect(res.ok).toBe(false);
      expect(res.error?.field).toBe('url');
    },
  );

  test('accepts http, https, mailto', async () => {
    const todo = await seedTodo();
    for (const url of ['https://example.com', 'http://intranet', 'mailto:a@b.c']) {
      const res = await addTodoLink({ todoId: todo.id, url }, { actor: await createMember() });
      expect(res.ok).toBe(true);
    }
  });
});

// ==============================
// Comments
// ==============================
describe('FR-18: comments ≤ 2000 chars, ordered oldest-first', () => {
  test('body over 2000 chars rejected', async () => {
    const todo = await seedTodo();
    const res = await postComment({ todoId: todo.id, body: 'x'.repeat(2001) }, { actor: await createMember() });
    expect(res.ok).toBe(false);
  });

  test('listed comments are ordered ascending by createdAt', async () => {
    const todo = await seedTodo();
    const a = await postComment({ todoId: todo.id, body: 'first' }, { actor: await createMember() });
    const b = await postComment({ todoId: todo.id, body: 'second' }, { actor: await createMember() });
    const { data: comments } = await listComments({ todoId: todo.id }, { actor: await createMember() });
    expect(comments.map((c) => c.body)).toEqual(['first', 'second']);
  });
});

describe('FR-19: only author edits own comment; edited_at set', () => {
  test('non-author edit rejected', async () => {
    const a = await createMember('a@x');
    const b = await createMember('b@x');
    const todo = await seedTodo();
    const { data: comment } = await postComment({ todoId: todo.id, body: 'hi' }, { actor: a });
    const res = await editComment({ id: comment.id, body: 'new' }, { actor: b });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('forbidden');
  });

  test('author edit sets editedAt', async () => {
    const a = await createMember('a@x');
    const todo = await seedTodo();
    const { data: comment } = await postComment({ todoId: todo.id, body: 'hi' }, { actor: a });
    const res = await editComment({ id: comment.id, body: 'new' }, { actor: a });
    expect(res.ok).toBe(true);
    expect(res.data.editedAt).toBeInstanceOf(Date);
  });
});

// ==============================
// Dashboard + views
// ==============================
describe('FR-20: dashboard payload', () => {
  test('returns activeSprint with correct goal aggregates', async () => {
    const user = await createMember();
    const s = await seedSprint({ status: 'active', withGoals: ['G1', 'G2'] });
    await seedTodo({ sprintId: s.id, sprintGoalId: s.goals[0].id, status: 'done' });
    await seedTodo({ sprintId: s.id, sprintGoalId: s.goals[0].id, status: 'todo' });
    await seedTodo({ sprintId: s.id, sprintGoalId: s.goals[1].id, status: 'in_progress' });

    const data = await getDashboardData({ actor: user });
    const g1 = data.activeSprint!.goalProgress.find((g) => g.name === 'G1')!;
    expect(g1.done).toBe(1);
    expect(g1.total).toBe(2);
    expect(data.activeSprint!.overall).toEqual({ done: 1, total: 3 });
  });

  test('my-todos is capped at 10 and sorted by dueDate asc nulls last', async () => {
    const user = await createMember();
    // 9 dated + 3 null = 12 total; expect 9 dated first then 1 null in the 10 returned
    for (let i = 0; i < 9; i++) {
      await seedTodo({
        assigneeUserId: user.id,
        dueDate: `2026-05-${String(i + 1).padStart(2, '0')}`,
      });
    }
    for (let i = 0; i < 3; i++) {
      await seedTodo({ assigneeUserId: user.id, dueDate: null });
    }
    const data = await getDashboardData({ actor: user });
    expect(data.myTodos).toHaveLength(10);
    expect(data.myTodos[0].dueDate).toBe('2026-05-01');
    expect(data.myTodos[8].dueDate).toBe('2026-05-09');
    expect(data.myTodos[9].dueDate).toBeNull(); // nulls last
  });

  test('upcoming deadlines are within 7 days and not done', async () => {
    const user = await createMember();
    await seedTodo({ dueDate: addDaysISO(3), status: 'in_progress' });
    await seedTodo({ dueDate: addDaysISO(10), status: 'in_progress' });
    await seedTodo({ dueDate: addDaysISO(2), status: 'done' });
    const data = await getDashboardData({ actor: user });
    expect(data.upcomingDeadlines).toHaveLength(1);
  });

  test('team activity shows last 15 newest-first', async () => {
    const user = await createMember();
    // space timestamps by 1ms to avoid `now()` tie resolution
    for (let i = 0; i < 20; i++) {
      await seedActivity({
        actorUserId: user.id,
        kind: 'todo_created',
        createdAt: new Date(Date.now() + i),
      });
    }
    const data = await getDashboardData({ actor: user });
    expect(data.activity).toHaveLength(15);
    expect(data.activity[0].createdAt.getTime()).toBeGreaterThanOrEqual(
      data.activity[14].createdAt.getTime(),
    );
  });
});

describe('FR-21: sprints grouped by status, sorted by start_date desc', () => {
  test('listSprints returns sprints grouped by status in the expected order', async () => {
    await seedSprint({ status: 'planned', startDate: '2026-05-01' });
    await seedSprint({ status: 'planned', startDate: '2026-04-01' });
    const { data } = await listSprints({}, { actor: await createMember() });
    const planned = data.filter((s) => s.status === 'planned');
    expect(planned.map((s) => s.startDate)).toEqual(['2026-05-01', '2026-04-01']);
  });
});

describe('FR-22: sprint detail groups by goal and surfaces "unassigned to goal"', () => {
  test('todos attached to sprint but no goal land in the unassigned group', async () => {
    const s = await seedSprint({ withGoals: ['A'] });
    await seedTodo({ sprintId: s.id, sprintGoalId: s.goals[0].id });
    await seedTodo({ sprintId: s.id, sprintGoalId: null });
    const { data } = await getSprintDetail({ id: s.id }, { actor: await createMember() });
    expect(data.todosGrouped.unassignedToGoal).toHaveLength(1);
  });
});

describe('FR-23: backlog filters', () => {
  test('priority filter narrows results', async () => {
    await seedTodo({ priority: 'high' });
    await seedTodo({ priority: 'low' });
    const { data } = await listTodos(
      { filter: { sprintScope: { kind: 'backlog' }, priority: 'high' } },
      { actor: await createMember() },
    );
    expect(data.every((t) => t.priority === 'high')).toBe(true);
  });
});

describe('FR-24: my todos spans sprints and backlog', () => {
  test('returns todos with assigneeUserId = current user across attachments', async () => {
    const me = await createMember();
    const s = await seedSprint();
    await seedTodo({ assigneeUserId: me.id, sprintId: s.id });
    await seedTodo({ assigneeUserId: me.id, sprintId: null });
    await seedTodo({ assigneeUserId: null });
    const { data } = await listTodos(
      { filter: { assigneeUserId: me.id, sprintScope: { kind: 'any' } } },
      { actor: me },
    );
    expect(data).toHaveLength(2);
  });
});

// ==============================
// Notifications
// ==============================
describe('FR-25: notification triggers', () => {
  test('assigning a todo creates an "assigned" notification for the new assignee', async () => {
    const actor = await createMember('a@x');
    const target = await createMember('b@x');
    const todo = await seedTodo();
    await updateTodo({ id: todo.id, assigneeUserId: target.id }, { actor });
    const n = await db.notification.findFirst({ where: { userId: target.id, kind: 'assigned' } });
    expect(n).not.toBeNull();
  });

  test('due-soon sweep creates exactly one notification per eligible todo per run', async () => {
    const assignee = await createMember();
    await seedTodo({
      assigneeUserId: assignee.id,
      status: 'in_progress',
      dueDate: addHoursISO(6),
    });
    await sweepDueSoonNotifications();
    await sweepDueSoonNotifications();
    const count = await db.notification.count({ where: { userId: assignee.id, kind: 'due_soon' } });
    expect(count).toBe(1);
  });

  test('comment on assigned todo creates a comment_on_assigned notification', async () => {
    const a = await createMember('a@x');
    const b = await createMember('b@x');
    const todo = await seedTodo({ assigneeUserId: b.id });
    await postComment({ todoId: todo.id, body: 'blocker' }, { actor: a });
    const n = await db.notification.findFirst({
      where: { userId: b.id, kind: 'comment_on_assigned', targetTodoId: todo.id },
    });
    expect(n).not.toBeNull();
  });
});

describe('FR-26: bell shows unread count + last 20, click marks read', () => {
  test('listNotifications returns unreadCount and capped items', async () => {
    const user = await createMember();
    for (let i = 0; i < 25; i++) await seedNotification({ userId: user.id });
    const { data } = await listNotifications({}, { actor: user });
    expect(data.items).toHaveLength(20);
    expect(data.unreadCount).toBeGreaterThan(0);
  });

  test('markNotificationRead sets read_at', async () => {
    const user = await createMember();
    const n = await seedNotification({ userId: user.id });
    await markNotificationRead({ id: n.id }, { actor: user });
    const after = await db.notification.findUnique({ where: { id: n.id } });
    expect(after?.readAt).toBeInstanceOf(Date);
  });

  test('markAllNotificationsRead only marks rows <= upToCreatedAt (race-safe)', async () => {
    const user = await createMember();
    const t1 = new Date(Date.now() - 30_000);
    const t2 = new Date(Date.now() - 15_000);
    const t3 = new Date(Date.now()); // arrives after the user read the list
    const n1 = await seedNotification({ userId: user.id, createdAt: t1 });
    const n2 = await seedNotification({ userId: user.id, createdAt: t2 });
    const n3 = await seedNotification({ userId: user.id, createdAt: t3 });

    // client saw up to t2 before clicking "mark all"
    await markAllNotificationsRead({ upToCreatedAt: t2.toISOString() }, { actor: user });

    const after = await db.notification.findMany({ where: { userId: user.id } });
    const byId = Object.fromEntries(after.map((n) => [n.id, n.readAt]));
    expect(byId[n1.id]).toBeInstanceOf(Date);
    expect(byId[n2.id]).toBeInstanceOf(Date);
    expect(byId[n3.id]).toBeNull(); // arrived after the user's cutoff
  });
});

describe('FR-27: no external notification channels in v1', () => {
  test('no email / push / slack libs are imported anywhere under src/', async () => {
    const files = await readAllTs('src');
    const offenders = files.filter((f) =>
      /nodemailer|@sendgrid\/mail|firebase-admin\/messaging|@slack\/web-api/.test(f.contents),
    );
    expect(offenders).toEqual([]);
  });
});

// ==============================
// Success measurement
// ==============================
describe('FR-28: sessions_log written on sign-in', () => {
  test('successful signIn callback writes a sessions_log row', async () => {
    const admin = await createAdmin();
    await handleSignInCallback({
      email: admin.email,
      displayName: admin.displayName,
      avatarUrl: null,
      provider: 'google',
    });
    const logs = await db.sessionsLog.findMany({ where: { userId: admin.id } });
    expect(logs.length).toBeGreaterThan(0);
  });

  test('WAU count matches users with sessions in last 7 days', async () => {
    await resetDb();
    const u1 = await createMember('u1@x');
    const u2 = await createMember('u2@x');
    const u3 = await createMember('u3@x');
    await seedSessionLog({ userId: u1.id, createdAt: daysAgo(1) });
    await seedSessionLog({ userId: u2.id, createdAt: daysAgo(3) });
    await seedSessionLog({ userId: u3.id, createdAt: daysAgo(10) });
    const { data } = await adminGetWau({}, { actor: await createAdmin() });
    expect(data.wauCount).toBe(2);
    expect(data.totalMembers).toBe(4); // 3 members + 1 admin
  });
});

// ==============================
// E2E (Playwright)
// ==============================
describe('E2E-1: daily team-member flow', () => {
  test('member signs in, sees dashboard, flips todo status, sees activity update', async ({ page }) => {
    // setup: seeded member + active sprint + a todo assigned to them
    await signInAsMember(page, 'member@example.com');
    await page.goto('/dashboard');

    await expect(page.getByRole('region', { name: /active sprint/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /my todos/i })).toBeVisible();

    const row = page.getByRole('listitem', { name: /my first todo/i });
    await row.click();
    await page.getByRole('button', { name: /status: todo/i }).click();
    await page.getByRole('menuitem', { name: /in progress/i }).click();

    await expect(page.getByRole('region', { name: /team activity/i })).toContainText(/status changed/i);
  });
});
```

---

## 14. Technical Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| OAuth provider misconfiguration at launch (callback URL, scopes) | Team cannot sign in at kickoff | Medium | Dry-run OAuth in staging with the exact launch domain; document env var checklist in §11; smoke-test both providers in Phase 1. |
| First-user bootstrap race (two simultaneous first sign-ins) | Two admins, or neither admitted | Very Low | Bootstrap runs in a serializable txn: `SELECT count(*) FROM users` + `INSERT … role='admin'` atomically; second caller falls through to the allowlist path and gets rejected. |
| Concurrent sprint activation creating two `active` sprints | Data integrity violation | Low | Partial unique index on `sprints(status) WHERE status='active'` is the DB-level guard; activation txn uses `FOR UPDATE` on the current active row; integration test covers race. |
| Markdown XSS via arbitrary paste | Account takeover / content injection | Medium (user content is arbitrary per FR-17) | DOMPurify on both server render and client render; no raw HTML passthrough; URL schemes restricted to http/https/mailto; test suite includes XSS payload fixtures. |
| Due-soon job runs multiple times on multiple instances (notification spam) | Duplicate notifications | Low (Vercel Cron is a single declared schedule per endpoint) | Partial unique index on `notifications(user_id, target_todo_id, kind) WHERE kind='due_soon'` is the hard dedup guarantee; cron handler validates `CRON_SECRET` to block external invocations. |
| Last-write-wins hides meaningful conflicts on the todo form | Lost edits | Medium | Surface the stale toast within 5s with the other editor's name so users can reload; we accept the simplicity trade-off per PRD §6. |
| Markdown 100KB × many todos bloats table size | Slow `todos` queries | Low | `todo_documents` is a separate table keyed by `todo_id`; `todos` queries never `SELECT` the document. |
| Vercel serverless cold starts push dashboard past 5s budget | Misses UX target | Medium | Vercel Fluid Compute + region-pin with Neon; decomposed latency budget in §10 shows p95 cold ≤ 3.95s; if Phase 8 measurement regresses, add keep-warm cron. |
| Malicious-scheme link (e.g., `javascript:`) rendered as clickable anchor | Stored XSS / 1-click session theft | Low | Closed in v1: Zod scheme check + DB `CHECK` restrict `todo_links.url` to `http/https/mailto`. Markdown anchors additionally sanitized by DOMPurify. |
| Admin deactivated user continues reading data until session expires | Terminated member retains access for hours | Medium | v1 relies on server-action `is_active` check; SSR page reads not guarded. **Deferred to v1.1** (Open Tech Q 14). Internal-team trust context accepted. |
| OAuth access/refresh tokens readable in DB dump | Credential theft on backup leak | Low (managed Postgres + restricted creds) | **Deferred to v1.1** (Open Tech Q 13). |
| PostHog outage disrupts user-facing flows | Degraded UX | Low | Fire events from a try/catch wrapper; never fail a server action because analytics failed. |
| `allowlist_entries` growing unbounded via typos | Admin chore | Low | Email is unique + lowercased; admin screen shows count and bulk remove; not a real blocker at 15 users. |
| Comment/notification tables unbounded growth | Long-term DB bloat | Low | `cleanupStaleNotifications` daily deletes read notifications > 30d; comments keep forever in v1 (manageable at this scale). |
| Prisma migration drift between dev and prod | Deploy failures | Low | CI runs `prisma migrate diff --from-schema-datamodel --to-migrations` to detect drift pre-deploy. |
| Admin deactivates the only admin | Org locked out | Low | Server action checks "last admin" before applying `deactivateUser` or role change; integration test covers this. |
| Mobile layout regressions | Users on the go get broken dashboard | Medium | Responsive tests at 375/768/1024/1440 in Playwright; shadcn + Tailwind handle the common cases; Phase 8 responsive review is a gate. |

---

## 15. Open Technical Questions

| # | Question | Status | Resolution / Impact |
|---|----------|--------|----------------------|
| 1 | Should `updateTodo` use optimistic concurrency tokens (reject stale writes) instead of the PRD-specified last-write-wins? | **Resolved** | Stay with last-write-wins + stale toast per PRD §6. The toast renders the other editor's name and the newer `updated_at` so users can reload. |
| 2 | Is Server-Sent Events (or websockets) required in v1 for the bell menu and activity feed? | **Resolved** | **No.** Cross-user visibility SLA accepted as the 30s polling interval (see §4). PRD's "stale edit toast within 5s" is downgraded to best-effort. Revisit in v1.1 if user complaints justify SSE. |
| 3 | What Postgres host (Neon vs Supabase vs RDS vs Render)? | **Resolved** | **Neon** (default). Free tier, Vercel-native, PgBouncer pool built-in. Migrate to dedicated tier when the team outgrows it. |
| 4 | Does "last write wins" apply to the markdown document the same way as to the todo fields? | **Resolved** | Treated identically. `saveTodoDocument` now accepts `expectedUpdatedAt` and returns `{ stale: true }` on mismatch (§3). The markdown editor surfaces the same stale toast as the todo form. |
| 5 | Should the "activity feed" and "team activity" retention be bounded? | Open | Ship unbounded in v1; v1.1 adds 1-year archival. |
| 6 | Should reopening a todo (`done` → `in_progress`) re-fire the assigned notification? | Open | Recommended: silent on reopen (matches PRD Open Question #5 default). Final call with product. |
| 7 | Should "allowlist removed" force-signout the user currently signed in? | **Deferred to v1.1** (see #14 below) | |
| 8 | What is the intended behavior when an assignee is deactivated? | Open | Recommended: `Todo.assigneeUserId` retained (FK is `SET NULL` but we soft-deactivate, so FK remains); UI renders a muted "inactive user" chip. Add to Phase 3. |
| 9 | Is there a maximum goal count per sprint? | Open | Recommended: soft cap at 10 with a UI warning; no DB limit. |
| 10 | Do we need distinct PostHog projects for staging and prod? | **Resolved** | Yes — env-keyed by `NEXT_PUBLIC_POSTHOG_KEY`. |
| 11 | Does "same email across Google and GitHub" map to one user or two? | Open | Recommended: same user, linked via the `accounts` table on matching email. Needs product sign-off. |
| 12 | What is the org admin's offboarding path? | Open (non-blocker for MVP but real lockout risk) | Recommended: add `promoteMember(userId)` admin action in v1.1. v1 workaround: direct SQL to change role. |
| 13 | **OAuth token encryption at rest (`accounts.access_token`, `refresh_token`, `id_token`).** | **Deferred to v1.1 — release-gated.** | v1 relies on managed-Postgres disk encryption + restricted credentials. v1.1 will add application-level AEAD keyed from `AUTH_SECRET`, or verify Auth.js v5 config can avoid persisting refresh tokens (via `token: false` in provider config where providers allow it). **Release gate:** must land before any user outside the founding team of ~15 is added to the allowlist, and in no case later than 2026-07-16 (90 days from v1 launch). Residual risk: a DB snapshot leak yields live OAuth tokens for the team. Accepted for internal-team MVP. |
| 14 | **Session revocation on admin deactivation / allowlist removal.** | **Deferred to v1.1 — release-gated, with interim mitigation.** | v1 server actions short-circuit on `is_active=false`, but a deactivated user's live session cookie can still drive SSR page reads until natural expiry. **Interim mitigation applied now:** Auth.js `session.maxAge` set to **24 hours** (down from the default 30 days) so the worst-case window is 1 day, not a month. v1.1 will add Next middleware that re-checks `users.is_active` on every request to `(app)/*` and deletes the Auth.js `sessions` row inside `deactivateUser`. Same release gate as Q13. Residual risk: up to 24h read-access lag after deactivation. |
| 15 | **Link scheme allow-list on `todo_links.url`.** | **Closed in v1** (moved out of deferral). | ~~Previously deferred~~. Reviewer noted this is a 10-minute fix; scope expanded to v1. Implementation: Zod `z.string().url().refine(u => ['http:','https:','mailto:'].includes(new URL(u).protocol))`; DB `CHECK (url ~* '^(https?|mailto):')`; unit test covering `javascript:`, `data:`, and other non-allowed schemes. Added to Phase 3 (Todos core). |
| 16 | Should the activity feed expose a dedicated "completed" event or infer from `todo_status_changed{to:'done'}`? | **Resolved** | **Infer from status-change payload.** `todo_completed` kind removed from enum (§2, §7). Activity feed UI derives the "completed" label from the payload. Avoids dedup in the feed. |
