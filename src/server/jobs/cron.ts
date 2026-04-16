/**
 * Cron job utilities — shared header validation.
 */
import type { NextRequest } from 'next/server';

/**
 * Validates the CRON_SECRET header on incoming Vercel Cron requests.
 * Returns true if the request is authorized, false otherwise.
 */
export function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env['CRON_SECRET'];
  if (!cronSecret) {
    // If no secret is configured, reject in production; allow in dev
    return process.env['NODE_ENV'] !== 'production';
  }

  // Vercel Cron sends the secret as the Authorization header: Bearer <secret>
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Also accept as x-cron-secret for local testing
  const cronHeader = request.headers.get('x-cron-secret');
  return cronHeader === cronSecret;
}
