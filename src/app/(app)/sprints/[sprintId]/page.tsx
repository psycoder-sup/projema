/**
 * Sprint detail page — FR-22.
 * Server component; fetches getSprintDetail and renders todos grouped by goal.
 */
import Link from 'next/link';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getSprintDetail } from '@/server/actions/sprints';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { User } from '@/types/domain';

interface SprintDetailPageProps {
  params: { sprintId: string };
}

const statusLabel: Record<string, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  planned: 'secondary',
  active: 'default',
  completed: 'outline',
};

export default async function SprintDetailPage({ params }: SprintDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-6 text-destructive">Unauthorized</div>;
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) {
    return <div className="p-6 text-destructive">User not found</div>;
  }

  const actor: User = {
    id: dbUser.id,
    email: dbUser.email ?? '',
    displayName: dbUser.displayName,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role as 'admin' | 'member',
    isActive: dbUser.isActive,
    lastSeenAt: dbUser.lastSeenAt,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  };

  const result = await getSprintDetail({ id: params.sprintId }, { actor });

  if (!result.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive font-semibold">
          {result.error.code === 'not_found' ? 'Sprint not found.' : result.error.message}
        </p>
      </div>
    );
  }

  const { sprint, todosGrouped } = result.data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold">{sprint.name}</h1>
            <Badge variant={statusVariant[sprint.status] ?? 'secondary'}>
              {statusLabel[sprint.status] ?? sprint.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {sprint.startDate} – {sprint.endDate}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" asChild size="sm">
            <Link href={`/sprints/${sprint.id}/edit`}>Edit</Link>
          </Button>
          <Button variant="outline" asChild size="sm">
            <Link href="/sprints">Back to sprints</Link>
          </Button>
        </div>
      </div>

      {/* Goals */}
      {sprint.goals.length > 0 && (
        <div className="space-y-4">
          {sprint.goals.map((goal) => {
            const goalTodos = todosGrouped.byGoal[goal.id] ?? [];
            return (
              <Card key={goal.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{goal.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {goalTodos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No todos in this goal.</p>
                  ) : (
                    <ul className="space-y-2">
                      {goalTodos.map((todo) => (
                        <li
                          key={todo.id}
                          className="flex items-center justify-between text-sm gap-2"
                        >
                          <span className={todo.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                            {todo.title}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {todo.status.replace('_', ' ')}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Unassigned to goal */}
      {todosGrouped.unassignedToGoal.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground">
              Unassigned to goal ({todosGrouped.unassignedToGoal.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {todosGrouped.unassignedToGoal.map((todo) => (
                <li key={todo.id} className="flex items-center justify-between text-sm gap-2">
                  <span className={todo.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                    {todo.title}
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {todo.status.replace('_', ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {sprint.goals.length === 0 && todosGrouped.unassignedToGoal.length === 0 && (
        <p className="text-muted-foreground text-sm">No goals or todos yet.</p>
      )}
    </div>
  );
}
