/**
 * TeamActivityCard — renders the last 15 activity events for the dashboard.
 * Each event is rendered as a human-readable line based on `kind`.
 * Wraps in shadcn Card for consistent layout in the 2x2 grid.
 * Empty state: "No team activity yet."
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityEvent } from '@/types/domain';

interface TeamActivityCardProps {
  events: ActivityEvent[];
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function eventLabel(event: ActivityEvent): string {
  const payload = event.payload as Record<string, unknown> | null;

  switch (event.kind) {
    case 'todo_created':
      return 'created a todo';
    case 'todo_status_changed': {
      const from = payload?.['from'] as string | undefined;
      const to = payload?.['to'] as string | undefined;
      if (from && to) {
        return `changed status from ${from.replace('_', '-')} to ${to.replace('_', '-')}`;
      }
      return 'changed todo status';
    }
    case 'todo_assigned': {
      return 'assigned a todo';
    }
    case 'comment_posted':
      return 'commented on a todo';
    case 'sprint_created':
      return 'created a sprint';
    case 'sprint_activated':
      return 'activated a sprint';
    case 'sprint_completed':
      return 'completed a sprint';
    default:
      return 'performed an action';
  }
}

function ActivityEventRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-b-0">
      {/* Actor avatar placeholder */}
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
        T
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm">
          <span className="font-medium">Team member</span>
          {' '}
          <span className="text-muted-foreground">{eventLabel(event)}</span>
        </span>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 ml-2">
        {formatRelativeTime(event.createdAt)}
      </span>
    </div>
  );
}

export function TeamActivityCard({ events }: TeamActivityCardProps) {
  return (
    <Card className="h-full flex flex-col" aria-label="Team activity">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Team Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Activity will appear here as your team uses the app.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <ActivityEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
