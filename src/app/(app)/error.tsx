'use client';
/**
 * Authenticated-app error boundary — catches errors in the (app) layout tree.
 * Adds an extra breadcrumb to Sentry for the authenticated context,
 * then renders a friendly retry UI with navigation back to the dashboard.
 * Phase 8: error boundary coverage (SPEC §12 Phase 8).
 */
import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'error-boundary',
      message: 'Caught in authenticated app error boundary',
      level: 'error',
      data: { digest: error.digest },
    });
    Sentry.captureException(error, {
      tags: { boundary: 'app' },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md">
          An error occurred loading this page. Our team has been notified.
        </p>
        {process.env['NODE_ENV'] === 'development' && error.message && (
          <pre className="mt-4 max-w-lg overflow-auto rounded bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retry
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
