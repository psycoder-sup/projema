/**
 * TeamActivityCard — renders the last 15 activity events for the dashboard.
 * Brutalist: newspaper wire-feed style with mono timestamps and square avatar blocks.
 */
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { ActivityEvent } from '@/types/domain';

interface TeamActivityCardProps {
  events: ActivityEvent[];
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'NOW';
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H`;
  const days = Math.floor(hours / 24);
  return `${days}D`;
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
        return `moved ${from.replace('_', '-')} → ${to.replace('_', '-')}`;
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

function eventKindTag(kind: ActivityEvent['kind']): string {
  switch (kind) {
    case 'todo_created':
      return 'TODO.NEW';
    case 'todo_status_changed':
      return 'TODO.MOVE';
    case 'todo_assigned':
      return 'TODO.ASGN';
    case 'comment_posted':
      return 'TODO.CMT';
    case 'sprint_created':
      return 'SPRINT.NEW';
    case 'sprint_activated':
      return 'SPRINT.LIVE';
    case 'sprint_completed':
      return 'SPRINT.DONE';
    default:
      return 'EVENT';
  }
}

function ActivityEventRow({ event }: { event: ActivityEvent }) {
  return (
    <li className="flex items-start gap-3 border-b-2 border-ink/60 py-2.5 last:border-b-0">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink bg-paper font-mono text-[11px] font-bold text-ink">
        T
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-semibold text-ink">Team member</span>{' '}
          <span className="text-muted-foreground">{eventLabel(event)}</span>
        </p>
        <span className="mt-0.5 inline-block border border-ink bg-paper px-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink">
          {eventKindTag(event.kind)}
        </span>
      </div>
      <span className="shrink-0 self-start font-mono text-[11px] font-bold tabular-nums text-ink">
        {formatRelativeTime(event.createdAt)}
      </span>
    </li>
  );
}

export function TeamActivityCard({ events }: TeamActivityCardProps) {
  return (
    <Card className="flex h-full flex-col shadow-brut" aria-label="Team activity">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="kicker">04 —</span>
          <h2 className="font-display text-lg uppercase tracking-tight">Wire Feed</h2>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse bg-rust" />
          live
        </span>
      </CardHeader>
      <CardContent className="flex-1">
        {events.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="font-display text-2xl uppercase leading-tight text-ink">
              Silent wire.
            </p>
            <p className="font-sans text-sm text-muted-foreground">
              Activity will appear here as your team uses the app.
            </p>
          </div>
        ) : (
          <ul>
            {events.map((event) => (
              <ActivityEventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
