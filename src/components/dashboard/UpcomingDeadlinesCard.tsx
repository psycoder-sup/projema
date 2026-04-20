/**
 * Upcoming Deadlines card — dense dark redesign.
 * Calendar date block + title + assignee/goal + due chip.
 */
import Link from 'next/link';
import type { Todo } from '@/types/domain';
import { diffDaysIso, dueLabel, shortMonth } from '@/components/layout/dense/utils';

interface AssigneeLookupEntry {
  id: string;
  displayName: string | null;
  email: string | null;
}

interface GoalLookupEntry {
  id: string;
  name: string;
  index: number;
}

interface UpcomingDeadlinesCardProps {
  todos: Todo[];
  assigneeLookup: Record<string, AssigneeLookupEntry>;
  goalLookup: Record<string, GoalLookupEntry>;
  todayIso: string;
}

function DeadlineRow({
  todo,
  assigneeLookup,
  goalLookup,
  todayIso,
}: {
  todo: Todo;
  assigneeLookup: Record<string, AssigneeLookupEntry>;
  goalLookup: Record<string, GoalLookupEntry>;
  todayIso: string;
}) {
  if (!todo.dueDate) return null;

  const date = new Date(todo.dueDate + 'T00:00:00Z');
  const diff = diffDaysIso(todo.dueDate, todayIso);
  const due = dueLabel(diff);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = shortMonth(date.getUTCMonth());

  const assignee = todo.assigneeUserId ? assigneeLookup[todo.assigneeUserId] : undefined;
  const goal = todo.sprintGoalId ? goalLookup[todo.sprintGoalId] : undefined;

  return (
    <Link href={`/todos/${todo.id}`} className={`deadline ${due.cls}`} aria-label={todo.title}>
      <div className="deadline-date">
        <div className="d">{day}</div>
        <div className="m">{month}</div>
      </div>
      <div className="deadline-body">
        <div className="t">{todo.title}</div>
        <div className="s">
          <span>{todo.id.slice(0, 6)}</span>
          {assignee && (
            <>
              <span className="sep">·</span>
              <span>{assignee.displayName ?? assignee.email ?? 'Unknown'}</span>
            </>
          )}
          <span className="sep">·</span>
          <span style={{ color: goal ? 'var(--fg-2)' : 'var(--fg-3)' }}>
            {goal?.name ?? 'Backlog'}
          </span>
        </div>
      </div>
      <div className={`todo-due ${due.cls}`}>{due.text}</div>
    </Link>
  );
}

export function UpcomingDeadlinesCard({ todos, assigneeLookup, goalLookup, todayIso }: UpcomingDeadlinesCardProps) {
  const visible = todos.slice(0, 5);

  return (
    <div className="dense-card" aria-label="Upcoming deadlines">
      <div className="card-head">
        <span className="card-title">
          <span className="idx">03 /</span> Upcoming deadlines
        </span>
        <div className="card-head-right">
          <span className="mini-link" style={{ color: 'var(--fg-2)' }}>
            next 7 days
          </span>
        </div>
      </div>
      <div className="deadlines">
        {visible.length === 0 ? (
          <div className="empty-state">
            <span className="t">Nothing burning</span>
            <span>No todos due in the next 7 days.</span>
          </div>
        ) : (
          visible.map((t) => (
            <DeadlineRow
              key={t.id}
              todo={t}
              assigneeLookup={assigneeLookup}
              goalLookup={goalLookup}
              todayIso={todayIso}
            />
          ))
        )}
      </div>
    </div>
  );
}
