#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Source .env.local so docker compose can interpolate DEV_DB_PORT while
# parsing the file (the value doesn't matter for `down -v`, but compose
# will warn if it's unset).
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi
export DEV_DB_PORT="${DEV_DB_PORT:-5432}"

PROJECT="$(basename "$PWD")"

echo "==> Wiping dev DB volume (project: ${PROJECT})..."
docker compose -f docker-compose.dev.yml down -v --remove-orphans
echo "Done. Data volume destroyed. Run 'pnpm dev:up' to recreate."
