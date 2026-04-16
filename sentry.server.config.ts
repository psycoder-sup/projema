/**
 * Sentry server-side configuration.
 * This file is loaded in the Next.js server runtime (Node.js).
 * Only active if SENTRY_ENABLED=true in dev, or always in production.
 */
import * as Sentry from '@sentry/nextjs';

const isDev = process.env['NODE_ENV'] === 'development';
const isEnabled = !isDev || process.env['SENTRY_ENABLED'] === 'true';

if (isEnabled && process.env['SENTRY_DSN']) {
  Sentry.init({
    dsn: process.env['SENTRY_DSN'],
    tracesSampleRate: isDev ? 1.0 : 0.1,
    debug: false,
  });
}
