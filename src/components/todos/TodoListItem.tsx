import Link from 'next/link';
import { TodoStatusChip } from './TodoStatusChip';
import { TodoPriorityChip } from './TodoPriorityChip';
import type { Todo } from '@/types/domain';

interface TodoListItemProps {
  todo: Todo;
}

export function TodoListItem({ todo }: TodoListItemProps) {
  const idShort = todo.id.slice(0, 6).toUpperCase();
  return (
    <Link
      href={`/todos/${todo.id}`}
      className="group relative flex items-start gap-4 border-2 border-ink bg-card p-4 transition-[transform,box-shadow,background-color] duration-100 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:bg-acid hover:shadow-brut-sm"
    >
      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-ink/70">
        T-{idShort}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{todo.title}</p>
        {todo.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground group-hover:text-ink/80">
            {todo.description}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <TodoStatusChip status={todo.status} />
          <TodoPriorityChip priority={todo.priority} />
          {todo.dueDate && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-ink/70">
              Due · {todo.dueDate}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
