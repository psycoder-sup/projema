import { type NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '../../../../server/jobs/cron';

/**
 * Vercel Cron: cleanup stale notifications and rate limit buckets.
 * Fires daily at 03:00 UTC. Phase 6 implementation — Phase 0 returns 501.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Phase 6: implement cleanupStaleNotifications()
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
