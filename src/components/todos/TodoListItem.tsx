import Link from 'next/link';
import { TodoStatusChip } from './TodoStatusChip';
import { TodoPriorityChip } from './TodoPriorityChip';
import type { Todo } from '@/types/domain';

interface TodoListItemProps {
  todo: Todo;
}

export function TodoListItem({ todo }: TodoListItemProps) {
  return (
    <Link
      href={`/todos/${todo.id}`}
      className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{todo.title}</p>
        {todo.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <TodoStatusChip status={todo.status} />
          <TodoPriorityChip priority={todo.priority} />
          {todo.dueDate && (
            <span className="text-xs text-muted-foreground">Due {todo.dueDate}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
