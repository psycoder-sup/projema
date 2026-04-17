'use client';
/**
 * TanStack Query client provider.
 * Phase 6 implementation.
 *
 * Wraps the app in a QueryClientProvider so client components can use
 * useQuery / useMutation. The QueryClient is created per-browser instance
 * (not per request) to share the cache across navigations.
 */
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't refetch on window focus for most queries — individual hooks
        // can override this.
        refetchOnWindowFocus: false,
        // 30s stale time as default for notification queries (SPEC §4).
        staleTime: 30_000,
      },
    },
  });
}

// Browser-side singleton — avoids creating a new client on every render
let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new client (no singleton)
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Use useState so that the client isn't recreated on re-renders
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
