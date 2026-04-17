/**
 * My Todos dashboard card — Phase 5 (FR-20).
 * Renders up to 10 todos assigned to the current user (non-done).
 * Empty state: "Nothing on your plate. Take a look at the backlog."
 */
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Todo } from '@/types/domain';

interface MyTodosCardProps {
  todos: Todo[];
}

function statusVariant(status: Todo['status']): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'done':
      return 'secondary';
    case 'in_progress':
      return 'default';
    default:
      return 'outline';
  }
}

function statusLabel(status: Todo['status']): string {
  switch (status) {
    case 'todo':
      return 'Todo';
    case 'in_progress':
      return 'In Progress';
    case 'done':
      return 'Done';
  }
}

function priorityDot(priority: Todo['priority']): string {
  switch (priority) {
    case 'high':
      return 'bg-red-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-green-500';
  }
}

function TodoRow({ todo }: { todo: Todo }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-b-0">
      {/* Priority dot */}
      <span
        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${priorityDot(todo.priority)}`}
        aria-label={`Priority: ${todo.priority}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{todo.title}</p>
        {todo.dueDate && (
          <p className="text-xs text-muted-foreground mt-0.5">Due {todo.dueDate}</p>
        )}
      </div>
      <Badge variant={statusVariant(todo.status)} className="shrink-0 text-xs ml-2">
        {statusLabel(todo.status)}
      </Badge>
    </div>
  );
}

export function MyTodosCard({ todos }: MyTodosCardProps) {
  return (
    <Card className="h-full flex flex-col" aria-label="My todos">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">My Todos</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {todos.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              Nothing on your plate. Take a look at the backlog.
            </p>
            <Link
              href="/todos"
              className="text-sm text-primary underline underline-offset-2 hover:no-underline"
            >
              View backlog
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {todos.map((todo) => (
              <TodoRow key={todo.id} todo={todo} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
