/**
 * Client-side PostHog initialization.
 * Initializes posthog-js once — guarded against SSR and repeated calls.
 *
 * Usage: import and call `initPostHogClient()` once (e.g. in a client provider).
 * After that, `posthog.capture(...)` can be called anywhere client-side.
 */
import posthog from 'posthog-js';

let _initialized = false;

export function initPostHogClient(): void {
  // Never run on the server
  if (typeof window === 'undefined') return;
  // Idempotent
  if (_initialized) return;

  const key = process.env['NEXT_PUBLIC_POSTHOG_KEY'];
  const host = process.env['NEXT_PUBLIC_POSTHOG_HOST'];

  if (!key || !host) {
    // Gracefully skip in environments without PostHog keys
    return;
  }

  posthog.init(key, {
    api_host: host,
    // Capture pageviews manually via PostHogPageView to align with Next.js
    // App Router navigation (soft navigations don't trigger full page loads).
    capture_pageview: false,
    // Disable in non-production unless explicitly enabled
    loaded: (ph) => {
      if (
        process.env['NODE_ENV'] !== 'production' &&
        process.env['NEXT_PUBLIC_POSTHOG_ENABLED'] !== 'true'
      ) {
        ph.opt_out_capturing();
      }
    },
  });

  _initialized = true;
}

export { posthog };
