'use client';
/**
 * Bell notification menu component — FR-27.
 * Phase 6 implementation.
 *
 * Polls /api/notifications/poll every 30s via TanStack Query.
 * Shows an unread badge, a dropdown list of up to 20 notifications,
 * and a "Mark all as read" link.
 *
 * Clicking a row marks it read and navigates to /todos/[targetTodoId].
 */
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { markNotificationRead, markAllNotificationsRead } from '@/server/actions/notifications';
import type { Notification, NotificationKind } from '@/types/domain';

// ============================================================================
// Helpers
// ============================================================================

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000); // seconds ago

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function notificationMessage(kind: NotificationKind): string {
  switch (kind) {
    case 'assigned':
      return 'You were assigned a todo';
    case 'comment_on_assigned':
      return 'Someone commented on your todo';
    case 'due_soon':
      return 'A todo assigned to you is due soon';
  }
}

function BadgeCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} unread notifications`}
      className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center border-2 border-ink bg-rust px-0.5 font-mono text-[9px] font-bold text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ============================================================================
// NotificationRow
// ============================================================================

interface NotificationRowProps {
  notification: Notification;
  onRead: (id: string, targetTodoId: string) => void;
}

function NotificationRow({ notification, onRead }: NotificationRowProps) {
  const isUnread = notification.readAt === null;

  return (
    <DropdownMenuItem
      className={`flex flex-col items-start gap-1 px-3 py-2 cursor-pointer ${isUnread ? 'font-medium' : 'text-muted-foreground'}`}
      onSelect={() => onRead(notification.id, notification.targetTodoId)}
    >
      <span className="text-sm">{notificationMessage(notification.kind)}</span>
      <span className="text-xs text-muted-foreground">
        {formatRelative(new Date(notification.createdAt))}
      </span>
    </DropdownMenuItem>
  );
}

// ============================================================================
// BellMenu
// ============================================================================

export function BellMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const state = useNotifications();

  const unreadCount = state.kind === 'ready' ? state.unreadCount : 0;
  const items = state.kind === 'ready' ? state.items : [];

  async function handleReadAndNavigate(id: string, targetTodoId: string) {
    await markNotificationRead({ id }, { actor: { id: '' } as never });
    // Invalidate so the badge updates immediately
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    router.push(`/todos/${targetTodoId}`);
  }

  async function handleMarkAllRead() {
    if (items.length === 0) return;
    const firstItem = items[0];
    if (!firstItem) return;

    // Boundary = "most recent" notification the user can see.
    // Notifications created after this boundary are NOT marked read.
    const newestCreatedAt = items.reduce(
      (newest, n) => (new Date(n.createdAt) > newest ? new Date(n.createdAt) : newest),
      new Date(firstItem.createdAt),
    );
    await markAllNotificationsRead(
      { upToCreatedAt: newestCreatedAt.toISOString() },
      { actor: { id: '' } as never },
    );
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center border-2 border-ink bg-paper transition-[transform,background-color] hover:bg-acid active:translate-x-[1px] active:translate-y-[1px]"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          <Bell className="h-4 w-4" strokeWidth={2.5} />
          <BadgeCount count={unreadCount} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {state.kind === 'loading' && (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">Loading...</div>
        )}

        {state.kind === 'error' && (
          <div className="px-3 py-4 text-sm text-destructive text-center">
            Failed to load notifications.
          </div>
        )}

        {state.kind === 'ready' && items.length === 0 && (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            You&apos;re all caught up.
          </div>
        )}

        {state.kind === 'ready' &&
          items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onRead={handleReadAndNavigate}
            />
          ))}

        {state.kind === 'ready' && items.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-sm text-muted-foreground cursor-pointer"
              onSelect={handleMarkAllRead}
            >
              Mark all as read
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
