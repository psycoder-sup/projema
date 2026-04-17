/**
 * Postgres-backed sliding-window rate limiter.
 *
 * Inserts a bucket row, counts rows within the window, returns whether the
 * request is allowed. All operations run inside the caller's transaction so
 * the insert and count are atomic with the surrounding mutation.
 *
 * The `cleanupStaleNotifications` job deletes rate_limit_buckets rows older
 * than 10 minutes to keep the table tight.
 */
import type { PrismaClient } from '@prisma/client';

type TxClient = PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export interface RateLimitOptions {
  userId: string;
  actionKey: string;
  windowSeconds: number;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  hits: number;
}

/**
 * Check and record a rate-limited action.
 *
 * Inserts a new bucket row, then counts all rows for the user/action within
 * the sliding window. Returns `allowed: false` if the count exceeds `limit`.
 *
 * Must be called inside an existing transaction so the insert + count are
 * atomic with the surrounding mutation.
 */
export async function checkRateLimit(
  tx: TxClient,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { userId, actionKey, windowSeconds, limit } = opts;

  // Insert a new bucket row for this event
  await (tx as PrismaClient).rateLimitBucket.create({
    data: {
      userId,
      actionKey,
    },
  });

  // Count rows within the sliding window
  const windowStart = new Date(Date.now() - windowSeconds * 1000);
  const hits = await (tx as PrismaClient).rateLimitBucket.count({
    where: {
      userId,
      actionKey,
      eventAt: {
        gt: windowStart,
      },
    },
  });

  return {
    allowed: hits <= limit,
    hits,
  };
}
