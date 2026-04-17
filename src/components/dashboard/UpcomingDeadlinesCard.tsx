/**
 * Upcoming Deadlines dashboard card — Phase 5 (FR-20).
 * Todos due within 7 days, status != done, any assignee, cap 15.
 * Empty state: "No upcoming deadlines in the next 7 days."
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      return 'Medium';
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

function DeadlineRow({ todo }: { todo: Todo }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{todo.title}</p>
        {todo.dueDate && (
          <p className="text-xs text-muted-foreground mt-0.5">Due {todo.dueDate}</p>
        )}
      </div>
      <Badge
        variant={priorityVariant(todo.priority)}
        className="shrink-0 text-xs ml-2"
      >
        {priorityLabel(todo.priority)}
      </Badge>
    </div>
  );
}

export function UpcomingDeadlinesCard({ todos }: UpcomingDeadlinesCardProps) {
  return (
    <Card className="h-full flex flex-col" aria-label="Upcoming deadlines">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {todos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No upcoming deadlines in the next 7 days.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {todos.map((todo) => (
              <DeadlineRow key={todo.id} todo={todo} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
