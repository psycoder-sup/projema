/**
 * Prisma seed script.
 * Gated behind NODE_ENV !== 'production' so it cannot accidentally run in production.
 * Full seed data (demo sprint, goals, todos) lands in Phase 1+.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    console.warn('Seed script is disabled in production. Exiting.');
    return;
  }

  console.log('Seed script running in development/test mode.');
  // Phase 1+: seed demo sprint, goals, users, and todos here.
  // For now, nothing to seed — the first OAuth sign-in bootstraps the admin.
  console.log('Seed complete (no-op for Phase 0).');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
