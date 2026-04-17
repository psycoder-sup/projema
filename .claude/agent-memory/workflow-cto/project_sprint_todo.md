---
name: Project profile — sprint-todo-management
description: Key constraints and context for the sprint-todo-management greenfield project, to inform future SPEC and architecture decisions.
type: project
---

Greenfield project. As of 2026-04-16 the repo contains only docs/; there is no existing codebase to conform to.

**Constraints pulled from PRD v1.0:**
- Single org, small team (~15 users max foreseeable).
- Web-only, responsive (desktop ≥ 1024px, mobile < 1024px). No native apps, no offline mode.
- Auth: Google OAuth and GitHub OAuth only. No email/password. First signup becomes admin; subsequent signups gated by admin-managed email allowlist.
- In-app notifications only (no email/push/Slack).
- Markdown docs on todos up to 100KB each, GFM, no images required in v1.
- Comments (plain text ≤ 2000 chars) on todos.
- Activity feed of last 15 events on dashboard.
- Fixed todo status set: todo / in-progress / done. No time tracking, no story points.
- Performance target: dashboard situational-awareness within 5 seconds of open.
- Primary success metric: ≥ 80% WAU/total by week 4.

**Why:** These constraints justify a boring, small-team stack rather than enterprise-grade infra. A single Postgres instance, a single web process, and an in-process job scheduler are sufficient for ~15 concurrent users.

**How to apply:** When speccing for this project, lean on mainstream choices (Next.js App Router + Postgres + Prisma + NextAuth or similar), and resist over-engineering (no k8s, no microservices, no event bus — a single deployable web app with background cron is enough).
