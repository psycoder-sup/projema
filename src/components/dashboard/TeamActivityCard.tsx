/**
 * Team Activity card — dense dark redesign.
 * Wire feed: avatar, "actor verb target", inline status transitions, time ago.
 */
import type { ActivityEvent } from '@/types/domain';
import { DenseAvatar } from '@/components/layout/dense/DenseAvatar';
import { DenseIcon } from '@/components/layout/dense/IconSprite';
import { formatTimeAgo } from '@/components/layout/dense/utils';

interface ActorEntry {
  id: string;
  displayName: string | null;
  email: string | null;
}

interface TeamActivityCardProps {
  events: ActivityEvent[];
  actorLookup: Record<string, ActorEntry>;
}

interface ParsedEvent {
  verb: string;
  target: string;
  asChip: boolean;
  from: string | null;
  to: string | null;
  toUser: string | null;
}

function parseEvent(event: ActivityEvent, actorLookup: Record<string, ActorEntry>): ParsedEvent {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const targetTitle = (payload['title'] as string | undefined) ?? null;
  const targetIdShort = event.targetTodoId
    ? event.targetTodoId.slice(0, 6)
    : event.targetSprintId
      ? event.targetSprintId.slice(0, 6)
      : '';
  const targetText = targetTitle ?? `${targetIdShort || 'item'}`;

  const base: ParsedEvent = {
    verb: 'performed an action',
    target: targetText,
    asChip: false,
    from: null,
    to: null,
    toUser: null,
  };

  switch (event.kind) {
    case 'todo_created':
      return { ...base, verb: 'created' };
    case 'todo_status_changed': {
      const from = payload['from'] as string | undefined;
      const to = payload['to'] as string | undefined;
      return {
        ...base,
        verb: 'moved',
        from: from ? from.replace('_', '-') : null,
        to: to ? to.replace('_', '-') : null,
      };
    }
    case 'todo_assigned': {
      const toId = payload['assigneeUserId'] as string | undefined;
      const toUser = toId
        ? (actorLookup[toId]?.displayName ?? actorLookup[toId]?.email ?? null)
        : null;
      return { ...base, verb: 'assigned', toUser };
    }
    case 'comment_posted':
      return { ...base, verb: 'commented on' };
    case 'sprint_created':
      return { ...base, verb: 'created sprint', asChip: true };
    case 'sprint_activated':
      return { ...base, verb: 'activated sprint', asChip: true };
    case 'sprint_completed':
      return { ...base, verb: 'completed sprint', asChip: true };
    default:
      return base;
  }
}

function ActivityItem({ event, actorLookup }: { event: ActivityEvent; actorLookup: Record<string, ActorEntry> }) {
  const actor = actorLookup[event.actorUserId];
  const parsed = parseEvent(event, actorLookup);

  return (
    <div className="act">
      <div className="act-ava">
        <DenseAvatar
          userId={event.actorUserId}
          displayName={actor?.displayName ?? null}
          email={actor?.email ?? null}
          size="sm"
        />
      </div>
      <div className="act-body">
        <b>{actor?.displayName ?? actor?.email ?? 'Someone'}</b>{' '}
        <span>{parsed.verb}</span>{' '}
        {parsed.asChip ? (
          <span className="chip">{parsed.target}</span>
        ) : (
          <span style={{ color: 'var(--fg-1)' }}>{parsed.target}</span>
        )}
        {parsed.from && parsed.to && (
          <>
            {' '}
            <span className="from">{parsed.from}</span> → <span className="to">{parsed.to}</span>
          </>
        )}
        {parsed.toUser && (
          <>
            {' '}
            <b>{parsed.toUser}</b>
          </>
        )}
      </div>
      <div className="act-time">{formatTimeAgo(new Date(event.createdAt))}</div>
    </div>
  );
}

export function TeamActivityCard({ events, actorLookup }: TeamActivityCardProps) {
  const visible = events.slice(0, 9);

  return (
    <div className="dense-card" aria-label="Team activity">
      <div className="card-head">
        <span className="card-title">
          <span className="idx">04 /</span> Team activity
        </span>
        <div className="card-head-right">
          <span className="mini-link" style={{ color: 'var(--fg-2)' }}>
            last 3 hours
          </span>
          <span className="mini-link">
            Feed <DenseIcon id="i-chev-r" />
          </span>
        </div>
      </div>
      <div className="activity">
        {visible.length === 0 ? (
          <div className="empty-state">
            <span className="t">Silent wire</span>
            <span>Activity will appear here as your team uses the app.</span>
          </div>
        ) : (
          visible.map((event) => (
            <ActivityItem key={event.id} event={event} actorLookup={actorLookup} />
          ))
        )}
      </div>
    </div>
  );
}
