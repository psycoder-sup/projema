#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Read a single KEY=value line from a dotenv file without sourcing it.
# Avoids executing shell metacharacters (e.g. $(...), backticks) that may
# appear inside secret values. Strips surrounding single/double quotes.
read_env() {
  local key="$1" file="${2:-.env.local}"
  [ -f "$file" ] || return 0
  local raw
  raw="$(grep -m1 "^${key}=" "$file" || true)"
  [ -n "${raw}" ] || return 0
  raw="${raw#${key}=}"
  raw="${raw%\"}"; raw="${raw#\"}"
  raw="${raw%\'}"; raw="${raw#\'}"
  printf '%s' "${raw}"
}

# Pull only the keys this script actually needs.
: "${DEV_DB_PORT:=$(read_env DEV_DB_PORT)}"

is_port_free() {
  ! lsof -iTCP:"$1" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

# --- Auto-allocate DEV_DB_PORT if the user hasn't pinned one ---
# Each worktree gets its own free host port the first time it runs `dev:up`.
# The chosen port is persisted to .env.local so subsequent runs are stable.
if [ -z "${DEV_DB_PORT:-}" ]; then
  PICKED=""
  for candidate in 5432 5433 5434 5435 5436 5437 5438; do
    if is_port_free "$candidate"; then
      PICKED="$candidate"
      break
    fi
  done
  if [ -z "${PICKED}" ]; then
    echo "ERROR: no free port in 5432–5438. Set DEV_DB_PORT manually in .env.local." >&2
    exit 1
  fi
  DEV_DB_PORT="${PICKED}"

  touch .env.local
  if ! grep -q '^DEV_DB_PORT=' .env.local; then
    {
      echo ""
      echo "# Auto-allocated by scripts/dev-up.sh"
      echo "DEV_DB_PORT=${DEV_DB_PORT}"
    } >> .env.local
    echo "==> Allocated host port ${DEV_DB_PORT} (persisted to .env.local)"
  fi
fi
export DEV_DB_PORT

COMPOSE=(docker compose -f docker-compose.dev.yml)
PROJECT="$(basename "$PWD")"
EXPECTED_URL="postgresql://postgres:dev@localhost:${DEV_DB_PORT}/project_managment?schema=public"

# --- Seed DATABASE_URL / DIRECT_URL in .env.local if missing ---
# Prisma needs both. On first run the worktree has no .env.local, so
# inject a local-dev default pointing at our container.
touch .env.local
if ! grep -q '^DATABASE_URL=' .env.local; then
  echo "DATABASE_URL=${EXPECTED_URL}" >> .env.local
  echo "==> Seeded DATABASE_URL in .env.local"
fi
if ! grep -q '^DIRECT_URL=' .env.local; then
  echo "DIRECT_URL=${EXPECTED_URL}" >> .env.local
  echo "==> Seeded DIRECT_URL in .env.local"
fi

# --- Inherit non-DB secrets from the main worktree's .env.local ---
# When running inside a git worktree, the "main" checkout lives next to the
# common git dir. Copy any Auth/OAuth/PostHog/Cron/Sentry keys the user has
# already configured there so the worktree doesn't need to be set up from
# scratch. Worktree-specific vars (DATABASE_URL, DIRECT_URL, DEV_DB_PORT)
# are never inherited.
MAIN_ENV=""
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  COMMON_GIT_DIR="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [ -n "${COMMON_GIT_DIR}" ] && [ -d "${COMMON_GIT_DIR}" ]; then
    MAIN_REPO="$(cd "${COMMON_GIT_DIR}/.." && pwd)"
    if [ "${MAIN_REPO}" != "${PWD}" ] && [ -f "${MAIN_REPO}/.env.local" ]; then
      MAIN_ENV="${MAIN_REPO}/.env.local"
    fi
  fi
fi

if [ -n "${MAIN_ENV}" ]; then
  INHERIT_KEYS=(
    AUTH_SECRET AUTH_URL
    GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
    POSTHOG_API_KEY NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST
    APP_BASE_URL ORG_TIMEZONE
    CRON_SECRET
    ADMIN_CONTACT_EMAIL
    SENTRY_ENABLED SENTRY_DSN SENTRY_ORG SENTRY_PROJECT SENTRY_AUTH_TOKEN
  )
  INHERITED_ANY=0
  for key in "${INHERIT_KEYS[@]}"; do
    if ! grep -q "^${key}=" .env.local; then
      line="$(grep -m1 "^${key}=" "${MAIN_ENV}" || true)"
      if [ -n "${line}" ]; then
        echo "${line}" >> .env.local
        INHERITED_ANY=1
      fi
    fi
  done
  if [ "${INHERITED_ANY}" = "1" ]; then
    echo "==> Inherited missing env vars from ${MAIN_ENV}"
  fi
fi

echo "==> Starting dev containers (project: ${PROJECT}, host port: ${DEV_DB_PORT})..."
"${COMPOSE[@]}" up -d

CONTAINER_ID="$("${COMPOSE[@]}" ps -q postgres)"
if [ -z "${CONTAINER_ID}" ]; then
  echo "ERROR: Postgres container did not start." >&2
  exit 1
fi

echo "==> Waiting for Postgres to be healthy..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' "${CONTAINER_ID}" 2>/dev/null || echo starting)" = "healthy" ]; do
  sleep 1
done

# --- Warn if DATABASE_URL in .env.local points at a different localhost port ---
CURRENT_URL="$(read_env DATABASE_URL)"
case "${CURRENT_URL}" in
  *localhost*|*127.0.0.1*)
    if [[ "${CURRENT_URL}" != *":${DEV_DB_PORT}/"* ]]; then
      echo ""
      echo "WARNING: DATABASE_URL in .env.local does not match DEV_DB_PORT=${DEV_DB_PORT}."
      echo "  Update it to: ${EXPECTED_URL}"
      echo ""
    fi
    ;;
esac

echo "==> Applying Prisma migrations..."
if [ -f .env.local ]; then
  pnpm dotenv -e .env.local -- pnpm prisma migrate deploy
else
  pnpm prisma migrate deploy
fi

echo "==> Generating Prisma client..."
pnpm prisma generate

echo ""
echo "Ready. Connection string (port ${DEV_DB_PORT}):"
echo "  DATABASE_URL=${EXPECTED_URL}"
echo "  DIRECT_URL=${EXPECTED_URL}"
echo ""
echo "Start the app with:  pnpm dev"
