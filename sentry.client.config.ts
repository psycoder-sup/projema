/**
 * Sentry client-side configuration.
 * This file is loaded in the browser.
 * Only active if SENTRY_ENABLED=true in dev, or always in production.
 */
import * as Sentry from '@sentry/nextjs';

const isDev = process.env.NODE_ENV === 'development';
const isEnabled = !isDev || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true';

if (isEnabled && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: isDev ? 1.0 : 0.1,
    debug: false,
  });
}
