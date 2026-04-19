#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Source .env.local so compose can interpolate DEV_DB_PORT while parsing the file.
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

export DEV_DB_PORT="${DEV_DB_PORT:-5432}"

PROJECT="$(basename "$PWD")"

echo "==> Stopping dev containers (project: ${PROJECT})..."
docker compose -f docker-compose.dev.yml down --remove-orphans

echo "Containers stopped. Data volume preserved."
echo "To wipe the database: docker compose -f docker-compose.dev.yml down -v"
