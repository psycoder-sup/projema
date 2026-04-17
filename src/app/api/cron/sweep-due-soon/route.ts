// sweep-due-soon: sweep due-soon notifications. Fires every 15 minutes.
import { validateCronSecret } from '@/server/jobs/cron';
import { sweepDueSoonNotifications } from '@/server/jobs/sweep-due-soon';

export async function GET(req: Request) {
  if (!validateCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await sweepDueSoonNotifications();
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
