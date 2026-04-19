/**
 * My Todos dashboard card — Phase 5 (FR-20).
 * Brutalist ticket list: mono index, priority block, status badge.
 * Empty state: "Nothing on your plate."
 */
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Todo } from '@/types/domain';

interface MyTodosCardProps {
  todos: Todo[];
}

function statusVariant(status: Todo['status']): 'default' | 'secondary' | 'outline' | 'acid' {
  switch (status) {
    case 'done':
      return 'outline';
    case 'in_progress':
      return 'acid';
    default:
      return 'secondary';
  }
}

function statusLabel(status: Todo['status']): string {
  switch (status) {
    case 'todo':
      return 'Todo';
    case 'in_progress':
      return 'Doing';
    case 'done':
      return 'Done';
  }
}

function priorityGlyph(priority: Todo['priority']): { bg: string; char: string; label: string } {
  switch (priority) {
    case 'high':
      return { bg: 'bg-rust text-white', char: 'H', label: 'High priority' };
    case 'medium':
      return { bg: 'bg-acid text-ink', char: 'M', label: 'Medium priority' };
    case 'low':
      return { bg: 'bg-paper text-ink', char: 'L', label: 'Low priority' };
  }
}

function TodoRow({ todo, index }: { todo: Todo; index: number }) {
  const prio = priorityGlyph(todo.priority);
  return (
    <li className="flex items-stretch gap-3 border-b-2 border-ink/60 py-3 last:border-b-0">
      <span className="font-mono text-[11px] font-bold tabular-nums text-muted-foreground pt-1">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span
        aria-label={prio.label}
        className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink font-mono text-[11px] font-bold ${prio.bg}`}
      >
        {prio.char}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{todo.title}</p>
        {todo.dueDate && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Due · {todo.dueDate}
          </p>
        )}
      </div>
      <Badge variant={statusVariant(todo.status)} className="shrink-0 self-start">
        {statusLabel(todo.status)}
      </Badge>
    </li>
  );
}

export function MyTodosCard({ todos }: MyTodosCardProps) {
  return (
    <Card className="flex h-full flex-col shadow-brut" aria-label="My todos">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="kicker">02 —</span>
          <h2 className="font-display text-lg uppercase tracking-tight">Your Plate</h2>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {String(todos.length).padStart(2, '0')} items
        </span>
      </CardHeader>
      <CardContent className="flex-1">
        {todos.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="font-display text-2xl uppercase leading-tight text-ink">
              Nothing on your plate.
            </p>
            <p className="font-sans text-sm text-muted-foreground">
              Nothing on your plate. Pick up a todo from the sprint board or create one.
            </p>
            <Link
              href="/todos"
              className="font-mono text-xs font-bold uppercase tracking-wider text-ink underline decoration-2 underline-offset-4 hover:decoration-acid"
            >
              → View backlog
            </Link>
          </div>
        ) : (
          <ul>
            {todos.map((todo, i) => (
              <TodoRow key={todo.id} todo={todo} index={i} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
