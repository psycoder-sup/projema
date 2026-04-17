/**
 * Notification cleanup job.
 * Phase 6 implementation.
 *
 * Removes read notifications older than 30 days and expired rate limit buckets
 * older than 10 minutes.
 */
import { prisma } from '@/server/db/client';

/**
 * Clean up stale data:
 * - notifications that have been read more than 30 days ago
 * - rate_limit_buckets older than 10 minutes
 *
 * Returns the total number of rows deleted.
 */
export async function cleanupStaleNotifications(): Promise<{ deleted: number }> {
  const [notifResult, rlResult] = await Promise.all([
    prisma.notification.deleteMany({
      where: {
        readAt: {
          not: null,
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.rateLimitBucket.deleteMany({
      where: {
        eventAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
    }),
  ]);

  return { deleted: notifResult.count + rlResult.count };
}
