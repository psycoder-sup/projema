import Link from 'next/link';
import type { Todo } from '@/types/domain';
import type { DashboardLookups } from '@/lib/dashboard/lookups';
import {
  diffDaysIso,
  dueLabel,
  parseIsoDate,
  shortId,
  shortMonth,
} from '@/components/layout/dense/utils';

interface UpcomingDeadlinesCardProps {
  todos: Todo[];
  lookups: DashboardLookups;
}

function DeadlineRow({ todo, lookups }: { todo: Todo; lookups: DashboardLookups }) {
  if (!todo.dueDate) return null;

  const date = parseIsoDate(todo.dueDate);
  const diff = diffDaysIso(todo.dueDate, lookups.todayIso);
  const due = dueLabel(diff);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = shortMonth(date.getUTCMonth());

  const assignee = todo.assigneeUserId ? lookups.actors[todo.assigneeUserId] : undefined;
  const goal = todo.sprintGoalId ? lookups.goals[todo.sprintGoalId] : undefined;

  return (
    <Link href={`/todos/${todo.id}`} className={`deadline ${due.cls}`} aria-label={todo.title}>
      <div className="deadline-date">
        <div className="d">{day}</div>
        <div className="m">{month}</div>
      </div>
      <div className="deadline-body">
        <div className="t">{todo.title}</div>
        <div className="s">
          <span>{shortId(todo.id)}</span>
          {assignee && (
            <>
              <span className="sep">·</span>
              <span>{assignee.displayName ?? assignee.email ?? 'Unknown'}</span>
            </>
          )}
          <span className="sep">·</span>
          <span className={goal ? 'deadline-goal' : 'deadline-goal--empty'}>
            {goal?.name ?? 'Backlog'}
          </span>
        </div>
      </div>
      <div className={`todo-due ${due.cls}`}>{due.text}</div>
    </Link>
  );
}

export function UpcomingDeadlinesCard({ todos, lookups }: UpcomingDeadlinesCardProps) {
  const visible = todos.slice(0, 5);

  return (
    <div className="dense-card" aria-label="Upcoming deadlines">
      <div className="card-head">
        <span className="card-title">
          <span className="idx">03 /</span> Upcoming deadlines
        </span>
        <div className="card-head-right">
          <span className="mini-link mini-link--muted">next 7 days</span>
        </div>
      </div>
      <div className="deadlines">
        {visible.length === 0 ? (
          <div className="empty-state">
            <span className="t">Nothing burning</span>
            <span>No todos due in the next 7 days.</span>
          </div>
        ) : (
          visible.map((t) => <DeadlineRow key={t.id} todo={t} lookups={lookups} />)
        )}
      </div>
    </div>
  );
}
