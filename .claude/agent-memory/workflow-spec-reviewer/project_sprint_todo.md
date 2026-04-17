---
name: Project profile — sprint-todo-management
description: Context for reviewing specs in this repo. Greenfield; spec now at v1.1.
type: project
---

Greenfield repo. Only PRD and SPEC exist at docs/feature/sprint-todo-management/. No code yet.

**Stack (per SPEC v1.1):** Next.js 14+ App Router, TypeScript strict, React 18, Tailwind + shadcn/ui,
TanStack Query, PostgreSQL 15+ via Prisma, Auth.js v5 (Google + GitHub), Zod validation,
react-markdown + remark-gfm + isomorphic-dompurify, **Vercel (committed) + Vercel Cron**, PostHog,
Vitest + Playwright + Testcontainers-postgres, Postgres-backed rate limiter (no in-process).

**Scale constraints:** single org, ~15 users, web-only responsive, in-app notifications only.

**Why:** Keep in mind when reviewing specs that architectural weight is sized for ~15 users — overengineering
is a real failure mode. At the same time, correctness primitives (transactions, unique indexes, CHECKs) still matter.

**How to apply:** When critiquing, challenge both (a) missing primitives the code will need and (b) machinery
that won't pay its rent at this scale.

**critic: v1.1 accepted deferrals** — three security items explicitly punted to v1.1 with residual-risk text in §15 (OAuth token encryption, session revocation on deactivation, link-scheme allow-list). Product direction says not to re-score as Blockers in v1.1 review, but call out honestly. `todo_completed` event kind removed; completion inferred from `todo_status_changed{to:'done'}`.
