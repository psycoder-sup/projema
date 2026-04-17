# Sprint Todo Management

A lightweight team sprint tracker: sprint goals → todos → personal dashboard, in one place.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in your values
pnpm dev                      # http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env.local`. Required vars:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Pooled Postgres URL (PgBouncer compatible) |
| `DIRECT_URL` | Direct Postgres URL (for migrations only) |
| `AUTH_SECRET` | 32+ char random string (`openssl rand -base64 32`) |
| `AUTH_URL` | App base URL (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth app credentials |
| `POSTHOG_API_KEY` / `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics keys |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL |
| `CRON_SECRET` | Secret for Vercel Cron endpoints |
| `APP_BASE_URL` | Full app URL without trailing slash |
| `ORG_TIMEZONE` | IANA timezone (default: `UTC`) |

See [`.env.example`](.env.example) for the full list.

## Running Tests

```bash
pnpm test:unit          # Vitest unit tests
pnpm test:integration   # Vitest integration tests (requires Docker for Testcontainers)
pnpm test:e2e           # Playwright e2e tests (requires a running app)
pnpm lint               # ESLint
pnpm typecheck          # TypeScript
```

## Architecture

Next.js App Router (server components + server actions) backed by PostgreSQL via Prisma. Auth.js handles Google OAuth with a Prisma session adapter. TanStack Query manages client-side cache and polling. Vercel Cron jobs handle background sweeps (due-soon notifications, WAU rollup). All server code is stateless; there is no long-running Node process.

## Docs

- [PRD](docs/feature/sprint-todo-management/sprint-todo-management-prd.md)
- [SPEC](docs/feature/sprint-todo-management/sprint-todo-management-spec.md)

## License

Private — internal use only.
