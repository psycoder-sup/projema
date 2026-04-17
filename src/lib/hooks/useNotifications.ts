'use client';
/**
 * Notifications TanStack Query hook.
 * Phase 6 implementation.
 *
 * Polls /api/notifications/poll every 30 seconds (SPEC §4).
 */
import { useQuery } from '@tanstack/react-query';
import type { NotificationsState, Notification } from '@/types/domain';

async function fetchNotifications(): Promise<{ items: Notification[]; unreadCount: number }> {
  const res = await fetch('/api/notifications/poll', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to fetch notifications');
  }
  const data = await res.json() as { items: Notification[]; unreadCount: number };
  return data;
}

/**
 * Returns the current notifications state for the authenticated user.
 * Polls every 30s to satisfy the cross-user freshness SLA (SPEC §4).
 */
export function useNotifications(): NotificationsState {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading) return { kind: 'loading' };
  if (isError) return { kind: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
  if (!data) return { kind: 'loading' };

  return {
    kind: 'ready',
    items: data.items,
    unreadCount: data.unreadCount,
  };
}
