/**
 * Cron job utilities — shared header validation and response helpers.
 */
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Validates the CRON_SECRET header on incoming Vercel Cron requests.
 * Returns true if the request is authorized, false otherwise.
 */
export function validateCronSecret(req: Request): boolean {
  const expected = env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (authHeader && safeEqual(authHeader, `Bearer ${expected}`)) return true;
  const cronHeader = req.headers.get('x-vercel-cron-signature') ?? req.headers.get('x-cron-secret');
  if (cronHeader && safeEqual(cronHeader, expected)) return true;
  return false;
}

export function notImplementedResponse(jobName: string): Response {
  return new Response(
    JSON.stringify({ error: 'Not Implemented', job: jobName, phase: 'stub' }),
    { status: 501, headers: { 'content-type': 'application/json' } }
  );
}
