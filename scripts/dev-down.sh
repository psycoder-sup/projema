#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Stopping local dev containers..."
docker compose -f docker-compose.dev.yml down

echo "Containers stopped. Data volume preserved."
echo "To wipe the database: docker compose -f docker-compose.dev.yml down -v"
