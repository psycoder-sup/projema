// cleanup: cleanup stale notifications and rate limit buckets. Fires daily at 03:00 UTC.
import { validateCronSecret } from '@/server/jobs/cron';
import { cleanupStaleNotifications } from '@/server/jobs/cleanup-notifications';

export async function GET(req: Request) {
  if (!validateCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await cleanupStaleNotifications();
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
