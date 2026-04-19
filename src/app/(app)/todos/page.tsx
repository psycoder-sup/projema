/**
 * Backlog page — FR-23.
 * Shows all todos with sprintId=null (not attached to any sprint).
 * Supports URL search params: assignee, status, priority.
 */
import { listTodos } from '@/server/actions/todos';
import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { TodoListItem } from '@/components/todos/TodoListItem';
import { NewTodoButton } from '@/components/todos/NewTodoButton';
import { EmptyState } from '@/components/empty-states/EmptyState';
import type { TodoStatus, TodoPriority } from '@/types/domain';

interface BacklogPageProps {
  searchParams: {
    status?: string;
    priority?: string;
    assignee?: string;
  };
}

export default async function BacklogPage({ searchParams }: BacklogPageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect('/sign-in');

  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!dbUser) redirect('/sign-in');

  const actor = {
    id: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.displayName,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role as 'admin' | 'member',
    isActive: dbUser.isActive,
    lastSeenAt: dbUser.lastSeenAt,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  };

  const result = await listTodos(
    {
      filter: {
        sprintScope: { kind: 'backlog' },
        status: searchParams.status as TodoStatus | undefined,
        priority: searchParams.priority as TodoPriority | undefined,
        assigneeUserId: searchParams.assignee,
      },
    },
    { actor },
  );

  const todos = result.ok ? result.data : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-10 lg:py-12">
      <header className="mb-8 border-b-2 border-ink pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker mb-3">
              <span className="mr-2 inline-block border-2 border-ink bg-acid px-1.5 py-[2px] text-ink">
                VOL.03
              </span>
              Unassigned work
            </p>
            <h1 className="display-lg">Backlog</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {String(todos.length).padStart(2, '0')} {todos.length === 1 ? 'todo' : 'todos'}
            </span>
            <NewTodoButton actor={actor} />
          </div>
        </div>
      </header>

      {todos.length === 0 ? (
        <EmptyState
          title="No backlog todos."
          description="Use Backlog to park work that isn't in a sprint yet."
          action={<NewTodoButton actor={actor} label="+ New todo" />}
        />
      ) : (
        <div className="space-y-3">
          {todos.map((todo) => (
            <TodoListItem key={todo.id} todo={todo} />
          ))}
        </div>
      )}
    </div>
  );
}
