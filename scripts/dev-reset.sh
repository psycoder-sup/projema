#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Read DEV_DB_PORT from .env.local without sourcing the file (avoids shell
# metachar evaluation on secrets). The value doesn't matter for `down -v`,
# but compose warns if it's unset.
read_env_port() {
  [ -f .env.local ] || return 0
  grep -m1 '^DEV_DB_PORT=' .env.local | sed 's/^DEV_DB_PORT=//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//' || true
}

export DEV_DB_PORT="${DEV_DB_PORT:-$(read_env_port)}"
export DEV_DB_PORT="${DEV_DB_PORT:-5432}"

PROJECT="$(basename "$PWD")"

echo "==> Wiping dev DB volume (project: ${PROJECT})..."
docker compose -f docker-compose.dev.yml down -v --remove-orphans
echo "Done. Data volume destroyed. Run 'pnpm dev:up' to recreate."
