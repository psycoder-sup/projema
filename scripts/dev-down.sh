#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Read DEV_DB_PORT from .env.local without sourcing (avoids shell metachar
# evaluation on user-supplied values). Compose interpolates ${DEV_DB_PORT}
# while parsing docker-compose.dev.yml, so we just need to export it.
read_env_port() {
  [ -f .env.local ] || return 0
  grep -m1 '^DEV_DB_PORT=' .env.local | sed 's/^DEV_DB_PORT=//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//' || true
}

export DEV_DB_PORT="${DEV_DB_PORT:-$(read_env_port)}"
export DEV_DB_PORT="${DEV_DB_PORT:-5432}"

PROJECT="$(basename "$PWD")"

echo "==> Stopping dev containers (project: ${PROJECT})..."
docker compose -f docker-compose.dev.yml down --remove-orphans

echo "Containers stopped. Data volume preserved."
echo "To wipe the database: docker compose -f docker-compose.dev.yml down -v"
