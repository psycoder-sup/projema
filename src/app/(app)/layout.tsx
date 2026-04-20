/**
 * Authenticated app shell layout — dense dark redesign.
 * Renders: dense sidebar (logo + org + nav + sprints + me-card)
 *          + dense header (crumbs + search + actions)
 *          + main content slot.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { loadDbUser } from '@/server/loaders/session-user';
import { PostHogPageView } from '@/components/layout/PostHogPageView';
import { DenseSidebar } from '@/components/layout/dense/DenseSidebar';
import { DenseHeader } from '@/components/layout/dense/DenseHeader';
import { IconSprite } from '@/components/layout/dense/IconSprite';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const userId = session.user.id;

  const [dbUser, sidebarSprintRows, myTodosCount, backlogCount, activeSprintCount] =
    await Promise.all([
      loadDbUser(userId),
      prisma.sprint.findMany({
        where: { status: { in: ['active', 'planned'] } },
        select: { id: true, name: true, status: true },
        orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
        take: 5,
      }),
      prisma.todo.count({
        where: { assigneeUserId: userId, status: { not: 'done' } },
      }),
      prisma.todo.count({
        where: { sprintId: null, status: { not: 'done' } },
      }),
      prisma.sprint.count({ where: { status: 'active' } }),
    ]);

  if (!dbUser) {
    redirect('/sign-in');
  }

  const orgName = 'parallax.co';
  const orgInitial = orgName.charAt(0).toUpperCase();

  return (
    <div className="dense-app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <IconSprite />
      <div className="shell">
        <DenseSidebar
          user={{
            id: dbUser.id,
            displayName: dbUser.displayName,
            email: dbUser.email,
            role: dbUser.role,
          }}
          orgName={orgName}
          orgInitial={orgInitial}
          sidebarSprints={sidebarSprintRows.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status as 'planned' | 'active' | 'completed',
          }))}
          counts={{
            myTodos: myTodosCount,
            backlog: backlogCount,
            activeSprints: activeSprintCount,
          }}
        />
        <div className="main">
          <DenseHeader orgName={orgName} actor={dbUser} />
          <PostHogPageView />
          <main id="main-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
