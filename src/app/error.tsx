'use client';
/**
 * Global error boundary — catches unhandled errors in the root layout tree.
 * Reports to Sentry and shows a friendly retry UI.
 * Phase 8: error boundary coverage (SPEC §12 Phase 8).
 */
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: 'global' },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground max-w-md">
              An unexpected error occurred. Our team has been notified. You can try again or
              refresh the page.
            </p>
            {process.env['NODE_ENV'] === 'development' && error.message && (
              <pre className="mt-4 max-w-lg overflow-auto rounded bg-muted p-3 text-left text-xs text-muted-foreground">
                {error.message}
              </pre>
            )}
          </div>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
