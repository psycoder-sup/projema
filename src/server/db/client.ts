/**
 * Prisma client singleton.
 * Guards against module re-initialization in Next.js development hot reload.
 * See: https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 *
 * In tests, the client is created lazily on first use so that DATABASE_URL
 * can be set in beforeAll (e.g. from Testcontainers) before connecting.
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma: PrismaClient = (() => {
  if (process.env['NODE_ENV'] === 'test') {
    // In test mode: always create fresh; do NOT cache on globalThis
    // so Testcontainers can set DATABASE_URL before first use.
    return new Proxy({} as PrismaClient, {
      get(_target, prop: string | symbol) {
        // Lazily resolve the real client on first property access
        if (!globalThis.__prisma) {
          globalThis.__prisma = createPrismaClient();
        }
        const client = globalThis.__prisma;
        const value = client[prop as keyof PrismaClient];
        if (typeof value === 'function') {
          return (value as (...args: unknown[]) => unknown).bind(client);
        }
        return value;
      },
    });
  }
  // Production / development: use globalThis singleton
  if (!globalThis.__prisma) {
    globalThis.__prisma = createPrismaClient();
  }
  return globalThis.__prisma;
})();

/**
 * In tests: call this to reset the cached Prisma client so the next
 * query creates a new connection (useful after DATABASE_URL changes).
 */
export function resetPrismaClient(): void {
  if (globalThis.__prisma) {
    void globalThis.__prisma.$disconnect();
    globalThis.__prisma = undefined;
  }
}
