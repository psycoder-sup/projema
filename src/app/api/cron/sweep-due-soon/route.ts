// sweep-due-soon: sweep due-soon notifications. Fires every 15 minutes.
import { validateCronSecret, notImplementedResponse } from '@/server/jobs/cron';

export async function GET(req: Request) {
  if (!validateCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }
  return notImplementedResponse('sweep-due-soon');
}
