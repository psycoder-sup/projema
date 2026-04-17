#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Starting local dev containers..."
docker compose -f docker-compose.dev.yml up -d

echo "==> Waiting for Postgres to be healthy..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' pm-postgres 2>/dev/null || echo starting)" = "healthy" ]; do
  sleep 1
done

echo "==> Applying Prisma migrations..."
if [ -f .env.local ]; then
  pnpm dotenv -e .env.local -- pnpm prisma migrate deploy
else
  pnpm prisma migrate deploy
fi

echo "==> Generating Prisma client..."
pnpm prisma generate

echo ""
echo "Ready. Connection string for .env.local:"
echo "  DATABASE_URL=postgresql://postgres:dev@localhost:5432/project_managment?schema=public"
echo "  DIRECT_URL=postgresql://postgres:dev@localhost:5432/project_managment?schema=public"
echo ""
echo "Start the app with:  pnpm dev"
