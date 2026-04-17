/**
 * New sprint page — FR-05.
 * Client form using SprintForm.
 */
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { SprintForm } from '@/components/sprints/SprintForm';
import type { User } from '@/types/domain';

export default async function NewSprintPage() {
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

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">New Sprint</h1>
      <SprintForm actor={actor} />
    </div>
  );
}
