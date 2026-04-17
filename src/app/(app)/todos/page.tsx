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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Backlog</h1>
        <span className="text-sm text-muted-foreground">{todos.length} todo{todos.length !== 1 ? 's' : ''}</span>
      </div>

      {todos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No backlog todos found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <TodoListItem key={todo.id} todo={todo} />
          ))}
        </div>
      )}
    </div>
  );
}
