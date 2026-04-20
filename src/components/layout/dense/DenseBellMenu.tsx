'use client';
/**
 * Notifications bell for the dense header (FR-27).
 * Re-uses the existing useNotifications poll hook + server actions; the
 * visual layer is dense-themed and owns the bell indicator.
 */
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useNotifications } from '@/lib/hooks/useNotifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/server/actions/notifications';
import type { Notification, NotificationKind } from '@/types/domain';
import { DenseIcon } from './IconSprite';
import { formatTimeAgo } from './utils';

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

interface RowProps {
  notification: Notification;
  onRead: (id: string, targetTodoId: string) => void;
}

function NotificationRow({ notification, onRead }: RowProps) {
  const unread = notification.readAt === null;
  return (
    <Dropdown.Item
      className={`dense-menu-item notif ${unread ? 'unread' : ''}`}
      onSelect={() => onRead(notification.id, notification.targetTodoId)}
    >
      <div className="notif-msg">{notificationMessage(notification.kind)}</div>
      <div className="notif-time">{formatTimeAgo(new Date(notification.createdAt), { long: true })}</div>
    </Dropdown.Item>
  );
}

export function DenseBellMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const state = useNotifications();

  const unreadCount = state.kind === 'ready' ? state.unreadCount : 0;
  const items = state.kind === 'ready' ? state.items : [];

  async function handleReadAndNavigate(id: string, targetTodoId: string) {
    await markNotificationRead({ id }, { actor: { id: '' } as never });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    router.push(`/todos/${targetTodoId}`);
  }

  async function handleMarkAllRead() {
    if (items.length === 0) return;
    const first = items[0];
    if (!first) return;
    const newest = items.reduce(
      (acc, n) => (new Date(n.createdAt) > acc ? new Date(n.createdAt) : acc),
      new Date(first.createdAt),
    );
    await markAllNotificationsRead(
      { upToCreatedAt: newest.toISOString() },
      { actor: { id: '' } as never },
    );
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  const ariaLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button type="button" className="h-btn" aria-label={ariaLabel}>
          <DenseIcon id="i-bell" />
          {unreadCount > 0 && <span className="bell-dot" aria-hidden />}
        </button>
      </Dropdown.Trigger>

      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          className="dense-menu dense-menu-wide"
        >
          <div className="dense-menu-header">
            <div className="dense-menu-title">Notifications</div>
            <div className="dense-menu-sub">
              {unreadCount > 0 ? `${unreadCount} unread` : 'No unread'}
            </div>
          </div>
          <Dropdown.Separator className="dense-menu-sep" />

          {state.kind === 'loading' && (
            <div className="dense-menu-empty">Loading…</div>
          )}
          {state.kind === 'error' && (
            <div className="dense-menu-empty error">Failed to load notifications.</div>
          )}
          {state.kind === 'ready' && items.length === 0 && (
            <div className="dense-menu-empty">You&apos;re all caught up.</div>
          )}

          {state.kind === 'ready' &&
            items.map((n) => (
              <NotificationRow key={n.id} notification={n} onRead={handleReadAndNavigate} />
            ))}

          {state.kind === 'ready' && items.length > 0 && unreadCount > 0 && (
            <>
              <Dropdown.Separator className="dense-menu-sep" />
              <Dropdown.Item
                className="dense-menu-item dense-menu-item-muted"
                onSelect={handleMarkAllRead}
              >
                Mark all as read
              </Dropdown.Item>
            </>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
