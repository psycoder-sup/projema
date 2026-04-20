/**
 * Dashboard page — dense dark redesign (FR-20).
 * Server component. Loads getDashboardData + enriches it with the user/goal/
 * sprint lookups the visual layer needs (actor names on the activity feed,
 * assignee names on deadlines, goal names on todos).
 */
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getDashboardData } from '@/server/db/dashboard';
import { loadDbUser } from '@/server/loaders/session-user';
import { ActiveSprintCard } from '@/components/dashboard/ActiveSprintCard';
import { MyTodosCard } from '@/components/dashboard/MyTodosCard';
import { UpcomingDeadlinesCard } from '@/components/dashboard/UpcomingDeadlinesCard';
import { TeamActivityCard } from '@/components/dashboard/TeamActivityCard';
import { DenseAvatar } from '@/components/layout/dense/DenseAvatar';
import { sprintDayMath, todayIsoInZone } from '@/components/layout/dense/utils';
import { env } from '@/lib/env';

function greetingFor(date: Date, timeZone: string): string {
  const hour = Number(
    date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone }),
  );
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatLocal(date: Date, timeZone: string): string {
  const dayPart = date.toLocaleString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  });
  const timePart = date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
  return `${dayPart} · ${timePart} local`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const actor = await loadDbUser(session.user.id);
  if (!actor) {
    redirect('/sign-in');
  }

  const data = await getDashboardData({ actor });

  // ── Lookups: actors, assignees, goals ────────────────────────────────────
  const allUserIds = new Set<string>();
  for (const ev of data.activity) {
    allUserIds.add(ev.actorUserId);
    const payload = (ev.payload ?? {}) as Record<string, unknown>;
    const assigneeId = payload['assigneeUserId'];
    if (typeof assigneeId === 'string') allUserIds.add(assigneeId);
  }
  for (const t of data.upcomingDeadlines) {
    if (t.assigneeUserId) allUserIds.add(t.assigneeUserId);
  }
  const goalIds = new Set<string>();
  for (const t of [...data.myTodos, ...data.upcomingDeadlines]) {
    if (t.sprintGoalId) goalIds.add(t.sprintGoalId);
  }

  const sinceWindow = new Date(Date.now() - 15 * 60_000);

  const [userRows, goalRows, onlineCount, onlineSample] = await Promise.all([
    allUserIds.size > 0
      ? prisma.user.findMany({
          where: { id: { in: Array.from(allUserIds) } },
          select: { id: true, displayName: true, email: true },
        })
      : Promise.resolve([] as Array<{ id: string; displayName: string | null; email: string | null }>),
    goalIds.size > 0
      ? prisma.sprintGoal.findMany({
          where: { id: { in: Array.from(goalIds) } },
          select: { id: true, name: true, position: true },
          orderBy: { position: 'asc' },
        })
      : Promise.resolve([] as Array<{ id: string; name: string; position: number }>),
    prisma.user.count({
      where: { isActive: true, lastSeenAt: { gte: sinceWindow } },
    }),
    prisma.user.findMany({
      where: { isActive: true, lastSeenAt: { gte: sinceWindow } },
      select: { id: true, displayName: true, email: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 4,
    }),
  ]);

  const actorLookup: Record<string, { id: string; displayName: string | null; email: string | null }> = {};
  for (const u of userRows) actorLookup[u.id] = u;

  // Pre-seed goalLookup with active-sprint ordering so the goal colour palette
  // lines up with the ActiveSprintCard's bars; then append any extras.
  // `goalProgress.goalId` may be null for the "unassigned" bucket — skip those
  // because they have no row in `goalRows`.
  const goalById = new Map(goalRows.map((g) => [g.id, g]));
  const activeSprintGoalIds = (data.activeSprint?.goalProgress ?? [])
    .map((g) => g.goalId)
    .filter((id): id is string => id !== null);
  const goalLookup: Record<string, { id: string; name: string; index: number }> = {};
  activeSprintGoalIds.forEach((id, index) => {
    const g = goalById.get(id);
    if (g) goalLookup[id] = { id, name: g.name, index };
  });
  let extraGoalIdx = activeSprintGoalIds.length;
  for (const g of goalRows) {
    if (!goalLookup[g.id]) {
      goalLookup[g.id] = { id: g.id, name: g.name, index: extraGoalIdx++ };
    }
  }

  const now = new Date();
  const tz = env.ORG_TIMEZONE;
  const greeting = greetingFor(now, tz);
  const localStamp = formatLocal(now, tz);
  const todayIso = todayIsoInZone(now, tz);

  // Single source of truth for sprint-day math; passed down to ActiveSprintCard.
  const sprintDays = data.activeSprint
    ? sprintDayMath(
        data.activeSprint.sprint.startDate,
        data.activeSprint.sprint.endDate,
        todayIso,
      )
    : null;

  let dayBadge: string | null = null;
  let paceFlavour = 'welcome back.';
  if (data.activeSprint && sprintDays) {
    const { totalDays, todayIndex } = sprintDays;
    // sprintDayMath returns 0 before start and totalDays+1 after end; the
    // 1..totalDays range is the in-window case.
    if (todayIndex === 0) {
      dayBadge = null;
    } else if (todayIndex > totalDays) {
      dayBadge = 'Sprint ended';
    } else {
      dayBadge = `Day ${todayIndex} of ${totalDays}`;
      if (data.activeSprint.overall.total > 0) {
        const timePct = (todayIndex / totalDays) * 100;
        const donePct =
          (data.activeSprint.overall.done / data.activeSprint.overall.total) * 100;
        const pace = donePct - timePct;
        if (pace > 5) paceFlavour = "you're ahead.";
        else if (pace < -5) paceFlavour = 'time to push.';
        else paceFlavour = "you're on pace.";
      }
    }
  }

  return (
    <div className="dash">
      <div className="dash-title-row">
        <div>
          <div className="dash-title">
            {greeting} — <span className="accent">{paceFlavour}</span>
          </div>
          <div className="dash-sub" style={{ marginTop: 6 }}>
            <span>{localStamp}</span>
            {dayBadge && (
              <>
                <span className="dot-sep" />
                <span>{dayBadge}</span>
              </>
            )}
            <span className="dot-sep" />
            <span className="live-dot">synced</span>
          </div>
        </div>
        <div className="dash-sub">
          <span>
            {onlineCount} teammate{onlineCount === 1 ? '' : 's'} online
          </span>
          <div style={{ display: 'flex' }}>
            {onlineSample.map((u, i) => (
              <span key={u.id} style={{ marginLeft: i === 0 ? 0 : -5 }}>
                <DenseAvatar
                  userId={u.id}
                  displayName={u.displayName}
                  email={u.email}
                  size="sm"
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid">
        <ActiveSprintCard
          data={data.activeSprint}
          totalDays={sprintDays?.totalDays ?? 1}
          todayIndex={sprintDays?.todayIndex ?? 0}
        />
        <MyTodosCard todos={data.myTodos} goalLookup={goalLookup} todayIso={todayIso} />
        <UpcomingDeadlinesCard
          todos={data.upcomingDeadlines}
          assigneeLookup={actorLookup}
          goalLookup={goalLookup}
          todayIso={todayIso}
        />
        <TeamActivityCard events={data.activity} actorLookup={actorLookup} />
      </div>
    </div>
  );
}
