import Link from 'next/link';
import type { Todo } from '@/types/domain';
import type { DashboardLookups } from '@/lib/dashboard/lookups';
import { DenseIcon } from '@/components/layout/dense/IconSprite';
import { diffDaysIso, dueLabel, goalColor, shortId } from '@/components/layout/dense/utils';

interface MyTodosCardProps {
  todos: Todo[];
  lookups: DashboardLookups;
}

function statusToCheckClass(status: Todo['status']): string {
  if (status === 'done') return 'check done';
  if (status === 'in_progress') return 'check in-progress';
  return 'check';
}

function shortGoalName(name: string, words = 3): string {
  return name.split(/\s+/).slice(0, words).join(' ');
}

function TodoRow({ todo, lookups }: { todo: Todo; lookups: DashboardLookups }) {
  const diff = todo.dueDate ? diffDaysIso(todo.dueDate, lookups.todayIso) : null;
  const due = dueLabel(diff);
  const goal = todo.sprintGoalId ? lookups.goals[todo.sprintGoalId] : undefined;
  const goalC = goal ? goalColor(goal.index) : 'var(--fg-4)';

  return (
    <Link href={`/todos/${todo.id}`} className="todo-row" aria-label={todo.title}>
      <span
        className={statusToCheckClass(todo.status)}
        role="img"
        aria-label={todo.status.replace('_', ' ')}
      />
      <span className="priority" data-p={todo.priority} aria-hidden />
      <div className="todo-title">{todo.title}</div>
      <div className="todo-meta">
        {goal ? (
          <span className="todo-tag">
            <span className="dot" style={{ ['--dot-c' as string]: goalC }} />
            {shortGoalName(goal.name)}
          </span>
        ) : (
          <span className="todo-tag todo-tag--backlog">
            <span className="dot" />
            Backlog
          </span>
        )}
      </div>
      <div className={`todo-due ${due.cls}`}>{due.text}</div>
      <span className="todo-id">{shortId(todo.id)}</span>
    </Link>
  );
}

export function MyTodosCard({ todos, lookups }: MyTodosCardProps) {
  const visible = todos.slice(0, 7);

  return (
    <div className="dense-card" aria-label="My todos">
      <div className="card-head">
        <span className="card-title">
          <span className="idx">02 /</span> My todos
        </span>
        <div className="card-head-right">
          <span className="mini-link mini-link--muted">{todos.length} active</span>
          <Link href="/todos/mine" className="mini-link">
            View all <DenseIcon id="i-chev-r" />
          </Link>
        </div>
      </div>
      <div className="todos-list">
        {visible.length === 0 ? (
          <div className="empty-state">
            <span className="t">Nothing on your plate</span>
            <span>Pick up a todo from the backlog or create a new one.</span>
            <Link href="/todos" className="mini-link mini-link--spaced">
              View backlog <DenseIcon id="i-chev-r" />
            </Link>
          </div>
        ) : (
          visible.map((t) => <TodoRow key={t.id} todo={t} lookups={lookups} />)
        )}
      </div>
    </div>
  );
}
