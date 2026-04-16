import { type NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '../../../../server/jobs/cron';

/**
 * Vercel Cron: sweep due-soon notifications.
 * Fires every 15 minutes. Phase 6 implementation — Phase 0 returns 501.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Phase 6: implement sweepDueSoonNotifications()
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
