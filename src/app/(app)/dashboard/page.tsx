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
import {
  formatLocalStamp,
  greetingFor,
  sprintDayMath,
  todayIsoInZone,
} from '@/components/layout/dense/utils';
import type { DashboardLookups } from '@/lib/dashboard/lookups';
import { env } from '@/lib/env';

const ONLINE_WINDOW_MS = 15 * 60_000;
const ONLINE_SAMPLE_SIZE = 4;

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

  const sinceWindow = new Date(Date.now() - ONLINE_WINDOW_MS);

  const [userRows, goalRows, onlineUsers] = await Promise.all([
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
    prisma.user.findMany({
      where: { isActive: true, lastSeenAt: { gte: sinceWindow } },
      select: { id: true, displayName: true, email: true },
      orderBy: { lastSeenAt: 'desc' },
    }),
  ]);

  const onlineCount = onlineUsers.length;
  const onlineSample = onlineUsers.slice(0, ONLINE_SAMPLE_SIZE);

  const actors: DashboardLookups['actors'] = {};
  for (const u of userRows) actors[u.id] = u;

  // Seed goal order with active-sprint progress so goalColor(i) in
  // ActiveSprintCard matches the tag dot color in MyTodosCard. Unassigned
  // goalProgress (null goalId) has no row in goalRows and is skipped.
  const goalById = new Map(goalRows.map((g) => [g.id, g]));
  const activeSprintGoalIds = (data.activeSprint?.goalProgress ?? [])
    .map((g) => g.goalId)
    .filter((id): id is string => id !== null);
  const goals: DashboardLookups['goals'] = {};
  activeSprintGoalIds.forEach((id, index) => {
    const g = goalById.get(id);
    if (g) goals[id] = { id, name: g.name, index };
  });
  let extraGoalIdx = activeSprintGoalIds.length;
  for (const g of goalRows) {
    if (!goals[g.id]) {
      goals[g.id] = { id: g.id, name: g.name, index: extraGoalIdx++ };
    }
  }

  const now = new Date();
  const tz = env.ORG_TIMEZONE;
  const greeting = greetingFor(now, tz);
  const localStamp = formatLocalStamp(now, tz);
  const todayIso = todayIsoInZone(now, tz);

  const lookups: DashboardLookups = { actors, goals, todayIso };

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
          <div className="dash-sub dash-sub--spaced">
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
          <div className="avatar-stack">
            {onlineSample.map((u) => (
              <DenseAvatar
                key={u.id}
                userId={u.id}
                displayName={u.displayName}
                email={u.email}
                size="sm"
              />
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
        <MyTodosCard todos={data.myTodos} lookups={lookups} />
        <UpcomingDeadlinesCard todos={data.upcomingDeadlines} lookups={lookups} />
        <TeamActivityCard events={data.activity} lookups={lookups} />
      </div>
    </div>
  );
}
