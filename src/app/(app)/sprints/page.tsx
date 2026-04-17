/**
 * Sprints list page — FR-21.
 * Server component; fetches listSprints and groups by status.
 */
import Link from 'next/link';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { listSprints } from '@/server/actions/sprints';
import { SprintCard } from '@/components/sprints/SprintCard';
import { Button } from '@/components/ui/button';
import type { User } from '@/types/domain';

export default async function SprintsPage() {
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

  const result = await listSprints({}, { actor });
  const sprints = result.ok ? result.data : [];

  const active = sprints.filter((s) => s.status === 'active');
  const planned = sprints.filter((s) => s.status === 'planned');
  const completed = sprints.filter((s) => s.status === 'completed');

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sprints</h1>
        <Button asChild>
          <Link href="/sprints/new">New sprint</Link>
        </Button>
      </div>

      {!result.ok && (
        <p className="text-destructive text-sm">Failed to load sprints: {result.error.message}</p>
      )}

      {/* Active */}
      {active.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3 text-green-700 dark:text-green-400">Active</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} actor={actor} />
            ))}
          </div>
        </section>
      )}

      {/* Planned */}
      {planned.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3 text-muted-foreground">Planned</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {planned.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} actor={actor} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3 text-muted-foreground">Completed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} actor={actor} />
            ))}
          </div>
        </section>
      )}

      {sprints.length === 0 && result.ok && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No sprints yet. Plan your first sprint.</p>
          <p className="text-sm mt-1">
            <Link href="/sprints/new" className="underline">
              New sprint
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
