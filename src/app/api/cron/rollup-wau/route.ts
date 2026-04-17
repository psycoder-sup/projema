// rollup-wau: rollup weekly active users. Fires every hour.
import { NextResponse } from 'next/server';
import { validateCronSecret } from '@/server/jobs/cron';
import { rollupWeeklyActive } from '@/server/jobs/rollup-wau';

export async function GET(req: Request): Promise<NextResponse> {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await rollupWeeklyActive();
  return NextResponse.json(result, { status: 200 });
}
