'use client';
/**
 * Tracks a pageview event on every route change using posthog-js.
 * Must be rendered inside the (app) authenticated layout so it only fires
 * for authenticated users (matching the user_id attached on init).
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initPostHogClient, posthog } from '@/lib/analytics/posthog-client';

export function PostHogPageView(): null {
  const pathname = usePathname();

  useEffect(() => {
    initPostHogClient();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    posthog.capture('$pageview', { $current_url: window.location.href });
  }, [pathname]);

  return null;
}
