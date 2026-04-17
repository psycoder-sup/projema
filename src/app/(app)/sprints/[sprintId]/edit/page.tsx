/**
 * Sprint edit page — FR-05.
 * Loads the sprint and renders SprintForm in edit mode.
 */
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getSprintDetail } from '@/server/actions/sprints';
import { SprintForm } from '@/components/sprints/SprintForm';
import type { User } from '@/types/domain';

interface EditSprintPageProps {
  params: { sprintId: string };
}

export default async function EditSprintPage({ params }: EditSprintPageProps) {
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
        <p className="text-destructive">
          {result.error.code === 'not_found' ? 'Sprint not found.' : result.error.message}
        </p>
      </div>
    );
  }

  const { sprint } = result.data;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Edit Sprint</h1>
      <SprintForm actor={actor} sprint={sprint} />
    </div>
  );
}
