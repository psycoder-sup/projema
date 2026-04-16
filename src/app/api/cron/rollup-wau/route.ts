import { type NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '../../../../server/jobs/cron';

/**
 * Vercel Cron: rollup weekly active users.
 * Fires every hour. Phase 7 implementation — Phase 0 returns 501.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Phase 7: implement rollupWeeklyActive()
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
