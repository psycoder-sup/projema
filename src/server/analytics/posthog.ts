/**
 * PostHog server-side analytics helper.
 * Phase 0: initialized but no events fired yet. Events land in Phase 7.
 */
import { PostHog } from 'posthog-node';
import { env } from '@/lib/env';

let _posthog: PostHog | null = null;

function getPostHogClient(): PostHog {
  if (!_posthog) {
    _posthog = new PostHog(env.POSTHOG_API_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      // Disable in test/development unless explicitly enabled
      disabled:
        process.env['NODE_ENV'] !== 'production' &&
        process.env['POSTHOG_ENABLED'] !== 'true',
    });
  }
  return _posthog;
}

/**
 * Emits a PostHog event from the server side.
 * Called after a DB transaction commits so failed writes never emit success events.
 * Phase 7: wire all event types from SPEC §8.
 */
export async function emitEvent(
  userId: string,
  eventName: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  try {
    const client = getPostHogClient();
    client.capture({
      distinctId: userId,
      event: eventName,
      properties: params,
    });
    // Flush per-request since Vercel functions are short-lived
    await client.flush();
  } catch {
    // Analytics failures are non-fatal — never bubble up to the caller
  }
}
