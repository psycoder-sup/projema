/**
 * Dashboard page — Phase 5 (FR-20).
 * Server component. Loads getDashboardData for all four sections.
 * Desktop: 2×2 CSS grid (Active Sprint | My Todos / Upcoming Deadlines | Team Activity).
 * Mobile: single-column stack in PRD-specified order.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getDashboardData } from '@/server/db/dashboard';
import { ActiveSprintCard } from '@/components/dashboard/ActiveSprintCard';
import { MyTodosCard } from '@/components/dashboard/MyTodosCard';
import { UpcomingDeadlinesCard } from '@/components/dashboard/UpcomingDeadlinesCard';
import { TeamActivityCard } from '@/components/dashboard/TeamActivityCard';
import type { User } from '@/types/domain';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) {
    redirect('/sign-in');
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

  const data = await getDashboardData({ actor });

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/*
       * Desktop (≥1024px): 2×2 CSS grid
       *   Col 1: Active Sprint (top-left) | Upcoming Deadlines (bottom-left)
       *   Col 2: My Todos (top-right)     | Team Activity (bottom-right)
       *
       * Mobile (<1024px): single column stack in PRD order:
       *   Active Sprint → My Todos → Upcoming Deadlines → Team Activity
       */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-4 lg:gap-6">
        {/* Top-left on desktop, 1st on mobile */}
        <div className="lg:row-start-1 lg:col-start-1">
          <ActiveSprintCard data={data.activeSprint} />
        </div>

        {/* Top-right on desktop, 2nd on mobile */}
        <div className="lg:row-start-1 lg:col-start-2">
          <MyTodosCard todos={data.myTodos} />
        </div>

        {/* Bottom-left on desktop, 3rd on mobile */}
        <div className="lg:row-start-2 lg:col-start-1">
          <UpcomingDeadlinesCard todos={data.upcomingDeadlines} />
        </div>

        {/* Bottom-right on desktop, 4th on mobile */}
        <div className="lg:row-start-2 lg:col-start-2">
          <TeamActivityCard events={data.activity} />
        </div>
      </div>
    </div>
  );
}
