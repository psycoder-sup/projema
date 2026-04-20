/**
 * My Todos card — dense dark redesign.
 * Compact list with status circle, priority bar, goal tag, due, id.
 */
import Link from 'next/link';
import type { Todo } from '@/types/domain';
import { DenseIcon } from '@/components/layout/dense/IconSprite';
import { diffDaysIso, dueLabel, goalColor } from '@/components/layout/dense/utils';

interface GoalLookupEntry {
  id: string;
  name: string;
  index: number;
}

interface MyTodosCardProps {
  todos: Todo[];
  goalLookup: Record<string, GoalLookupEntry>;
  todayIso: string;
}

function statusToCheckClass(status: Todo['status']): string {
  if (status === 'done') return 'check done';
  if (status === 'in_progress') return 'check in-progress';
  return 'check';
}

function shortGoalName(name: string, words = 3): string {
  return name.split(/\s+/).slice(0, words).join(' ');
}

function TodoRow({ todo, goalLookup, todayIso }: { todo: Todo; goalLookup: Record<string, GoalLookupEntry>; todayIso: string }) {
  const diff = todo.dueDate ? diffDaysIso(todo.dueDate, todayIso) : null;
  const due = dueLabel(diff);
  const goal = todo.sprintGoalId ? goalLookup[todo.sprintGoalId] : undefined;
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
            <span className="dot" style={{ background: goalC }} />
            {shortGoalName(goal.name)}
          </span>
        ) : (
          <span className="todo-tag" style={{ opacity: 0.75 }}>
            <span className="dot" style={{ background: 'var(--fg-4)' }} />
            Backlog
          </span>
        )}
      </div>
      <div className={`todo-due ${due.cls}`}>{due.text}</div>
      <span className="todo-id">{todo.id.slice(0, 6)}</span>
    </Link>
  );
}

export function MyTodosCard({ todos, goalLookup, todayIso }: MyTodosCardProps) {
  const visible = todos.slice(0, 7);

  return (
    <div className="dense-card" aria-label="My todos">
      <div className="card-head">
        <span className="card-title">
          <span className="idx">02 /</span> My todos
        </span>
        <div className="card-head-right">
          <span className="mini-link" style={{ color: 'var(--fg-2)' }}>
            {todos.length} active
          </span>
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
            <Link href="/todos" className="mini-link" style={{ marginTop: 6 }}>
              View backlog <DenseIcon id="i-chev-r" />
            </Link>
          </div>
        ) : (
          visible.map((t) => (
            <TodoRow key={t.id} todo={t} goalLookup={goalLookup} todayIso={todayIso} />
          ))
        )}
      </div>
    </div>
  );
}
