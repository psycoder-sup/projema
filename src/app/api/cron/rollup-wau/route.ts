// rollup-wau: rollup weekly active users. Fires every hour.
import { validateCronSecret, notImplementedResponse } from '@/server/jobs/cron';

export async function GET(req: Request) {
  if (!validateCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }
  return notImplementedResponse('rollup-wau');
}
