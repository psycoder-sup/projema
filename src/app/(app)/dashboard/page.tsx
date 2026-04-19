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

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="px-4 py-8 lg:px-10 lg:py-12">
      {/* Masthead */}
      <header className="relative mb-10 border-b-2 border-ink pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker mb-3">
              <span className="mr-2 inline-block border-2 border-ink bg-acid px-1.5 py-[2px] text-ink">
                VOL.01
              </span>
              {today}
            </p>
            <h1 className="display-xl">
              The
              <br />
              <span className="inline-block">
                <span className="relative">
                  Daily
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-1 -z-10 h-3 bg-acid"
                  />
                </span>{' '}
                Ledger
              </span>
            </h1>
          </div>
          <div className="max-w-xs font-mono text-xs leading-relaxed text-muted-foreground">
            <p className="text-ink">{'// Four panels. Where the team stands today.'}</p>
            <p className="mt-2">
              Active sprint · Your plate · Burning deadlines · Team signal.
            </p>
          </div>
        </div>
      </header>

      {/*
       * Desktop (≥1024px): 2×2 CSS grid
       *   Col 1: Active Sprint (top-left) | Upcoming Deadlines (bottom-left)
       *   Col 2: My Todos (top-right)     | Team Activity (bottom-right)
       *
       * Mobile (<1024px): single column stack in PRD order:
       *   Active Sprint → My Todos → Upcoming Deadlines → Team Activity
       */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:grid-rows-2 lg:gap-8">
        <div className="lg:col-start-1 lg:row-start-1">
          <ActiveSprintCard data={data.activeSprint} />
        </div>

        <div className="lg:col-start-2 lg:row-start-1">
          <MyTodosCard todos={data.myTodos} />
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <UpcomingDeadlinesCard todos={data.upcomingDeadlines} />
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          <TeamActivityCard events={data.activity} />
        </div>
      </div>
    </div>
  );
}
