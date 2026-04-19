/**
 * Upcoming Deadlines dashboard card — Phase 5 (FR-20).
 * Todos due within 7 days, status != done, any assignee, cap 15.
 * Brutalist: calendar-strip layout with day block per todo.
 */
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Todo } from '@/types/domain';

interface UpcomingDeadlinesCardProps {
  todos: Todo[];
}

function priorityLabel(priority: Todo['priority']): string {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Med';
    case 'low':
      return 'Low';
  }
}

function priorityVariant(
  priority: Todo['priority'],
): 'destructive' | 'secondary' | 'outline' {
  switch (priority) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
  }
}

function formatDayBlock(dateStr: string | null | undefined): {
  day: string;
  month: string;
} {
  if (!dateStr) return { day: '——', month: '——' };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { day: '——', month: '——' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
  };
}

function daysUntil(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return `${Math.abs(diff)}d OVERDUE`;
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'TOMORROW';
  return `IN ${diff}D`;
}

function DeadlineRow({ todo }: { todo: Todo }) {
  const block = formatDayBlock(todo.dueDate);
  const urgency = daysUntil(todo.dueDate);
  const isOverdue = urgency.includes('OVERDUE') || urgency === 'TODAY';

  return (
    <li className="flex items-stretch gap-3 border-b-2 border-ink/60 py-3 last:border-b-0">
      <div
        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center border-2 border-ink ${
          isOverdue ? 'bg-rust text-white' : 'bg-paper text-ink'
        }`}
      >
        <span className="font-display text-xl leading-none tabular-nums">{block.day}</span>
        <span className="mt-0.5 font-mono text-[9px] font-bold tracking-widest">
          {block.month}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{todo.title}</p>
        <p className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <span className={isOverdue ? 'font-bold text-rust' : 'text-muted-foreground'}>
            {urgency}
          </span>
        </p>
      </div>
      <Badge variant={priorityVariant(todo.priority)} className="shrink-0 self-start">
        {priorityLabel(todo.priority)}
      </Badge>
    </li>
  );
}

export function UpcomingDeadlinesCard({ todos }: UpcomingDeadlinesCardProps) {
  return (
    <Card className="flex h-full flex-col shadow-brut" aria-label="Upcoming deadlines">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="kicker">03 —</span>
          <h2 className="font-display text-lg uppercase tracking-tight">Burning</h2>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Next 7 days
        </span>
      </CardHeader>
      <CardContent className="flex-1">
        {todos.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="font-display text-2xl uppercase leading-tight text-ink">
              Nothing burning.
            </p>
            <p className="font-sans text-sm text-muted-foreground">
              No todos due in the next 7 days.
            </p>
          </div>
        ) : (
          <ul>
            {todos.map((todo) => (
              <DeadlineRow key={todo.id} todo={todo} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
