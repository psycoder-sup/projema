import Link from 'next/link';
import type { DashboardData } from '@/types/domain';
import { DenseIcon } from '@/components/layout/dense/IconSprite';
import { goalColor, parseIsoDate, shortMonth } from '@/components/layout/dense/utils';
import { ProgressArc } from './dense/ProgressArc';
import { GoalRow } from './dense/GoalRow';

const UNASSIGNED_KEY = '__unassigned__';

interface ActiveSprintCardProps {
  data: DashboardData['activeSprint'];
  totalDays: number;
  todayIndex: number;
}

interface DayCell {
  dayNum: number;
  cal: number;
  monthIdx: number;
  isWeekend: boolean;
  past: boolean;
  today: boolean;
}

function buildDays(
  startDate: string,
  endDate: string,
  totalDays: number,
  todayIndex: number,
): {
  cells: DayCell[];
  startLabel: string;
  endLabel: string;
} {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const dayMs = 86_400_000;

  const cells: DayCell[] = [];
  for (let i = 0; i < totalDays; i++) {
    const cellDate = new Date(start.getTime() + i * dayMs);
    const dow = cellDate.getUTCDay();
    cells.push({
      dayNum: i + 1,
      cal: cellDate.getUTCDate(),
      monthIdx: cellDate.getUTCMonth(),
      isWeekend: dow === 0 || dow === 6,
      past: i + 1 < todayIndex,
      today: i + 1 === todayIndex,
    });
  }

  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmt = (d: Date) => {
    const dow = dows[d.getUTCDay()] ?? '';
    return `${dow} ${d.getUTCDate()} ${shortMonth(d.getUTCMonth())}`;
  };

  return {
    cells,
    startLabel: `${fmt(start)} · start`,
    endLabel: `${fmt(end)} · end`,
  };
}

function SprintTimeline({
  startDate,
  endDate,
  totalDays,
  todayIndex,
}: {
  startDate: string;
  endDate: string;
  totalDays: number;
  todayIndex: number;
}) {
  const { cells, startLabel, endLabel } = buildDays(startDate, endDate, totalDays, todayIndex);
  const todayLabel =
    todayIndex === 0
      ? 'before start'
      : todayIndex > totalDays
        ? 'sprint ended'
        : `Day ${todayIndex} of ${totalDays} · today`;
  return (
    <div className="timeline" aria-label={`Sprint timeline, day ${todayIndex} of ${totalDays}`}>
      <div
        className="timeline-ticks"
        style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}
      >
        {cells.map((d) => {
          const cls = ['tick'];
          if (d.past) cls.push('past');
          if (d.today) cls.push('today');
          if (d.isWeekend) cls.push('weekend');
          return (
            <div
              key={d.dayNum}
              className={cls.join(' ')}
              title={`Day ${d.dayNum} · ${shortMonth(d.monthIdx)} ${d.cal}`}
            >
              <div className="d">{d.cal}</div>
            </div>
          );
        })}
      </div>
      <div className="timeline-labels">
        <span>{startLabel}</span>
        <span>{todayLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

function EmptySprint() {
  return (
    <div className="dense-card span-2" aria-label="Active sprint">
      <div className="card-head">
        <span className="card-title">
          <span className="idx">01 /</span> Active sprint
        </span>
      </div>
      <div className="empty-state">
        <span className="t">No active sprint</span>
        <span>Plan a sprint to start tracking goals.</span>
        <Link href="/sprints/new" className="mini-link mini-link--spaced-lg">
          + Create sprint
        </Link>
      </div>
    </div>
  );
}

export function ActiveSprintCard({ data, totalDays, todayIndex }: ActiveSprintCardProps) {
  if (data === null) {
    return <EmptySprint />;
  }

  const { sprint, goalProgress, overall } = data;

  const beforeStart = todayIndex === 0;
  const afterEnd = todayIndex > totalDays;
  const inWindow = !beforeStart && !afterEnd;

  const pct = overall.total === 0 ? 0 : (overall.done / overall.total) * 100;
  const elapsedDays = inWindow ? todayIndex : afterEnd ? totalDays : 0;
  const remaining = Math.max(0, totalDays - elapsedDays);
  const timePct = (elapsedDays / totalDays) * 100;
  const pace = pct - timePct;
  const paceLabel =
    Math.abs(pace) < 1
      ? 'on pace'
      : pace >= 0
        ? `+${Math.round(pace)}% ahead of pace`
        : `${Math.round(pace)}% behind pace`;

  const fmtDate = (iso: string) => {
    const d = parseIsoDate(iso);
    return `${shortMonth(d.getUTCMonth())} ${d.getUTCDate()}`;
  };

  return (
    <div className="dense-card span-2" aria-label="Active sprint">
      <div className="card-head">
        <span className="card-title">
          <span className="idx">01 /</span> Active sprint
        </span>
        <div className="card-head-right">
          <Link href={`/sprints/${sprint.id}`} className="mini-link">
            <DenseIcon id="i-log" /> Log
          </Link>
          <Link href={`/sprints/${sprint.id}`} className="mini-link">
            Details <DenseIcon id="i-chev-r" />
          </Link>
        </div>
      </div>
      <div className="sprint">
        <div className="sprint-head">
          <div className="sprint-meta">
            <div className="sprint-name">
              {sprint.name}
              <span className="badge active">Active</span>
            </div>
            <div className="sprint-sub">
              <span>{fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}</span>
              <span className="dot-sep" />
              <span>
                {afterEnd
                  ? 'ended'
                  : remaining === 0
                    ? 'final day'
                    : `${remaining} day${remaining === 1 ? '' : 's'} remaining`}
              </span>
              <span className="dot-sep" />
              <span className="live-dot">live</span>
            </div>
          </div>
          <div className="sprint-nums">
            <div className="num-block">
              <div className="n">
                {overall.done}
                <span className="tot">/{overall.total}</span>
              </div>
              <div className="l">Todos done</div>
            </div>
            <div className="num-block">
              <div className="n">{goalProgress.length}</div>
              <div className="l">Goals</div>
            </div>
            <div className="num-block">
              <div className="n">
                {beforeStart ? (
                  <>—</>
                ) : (
                  <>
                    {elapsedDays}
                    <span className="tot">/{totalDays}</span>
                  </>
                )}
              </div>
              <div className="l">Day</div>
            </div>
          </div>
        </div>

        <div className="sprint-main">
          <div className="sprint-main-col">
            <SprintTimeline
              startDate={sprint.startDate}
              endDate={sprint.endDate}
              totalDays={totalDays}
              todayIndex={todayIndex}
            />
            <div className="goals-head">
              <span className="t">Goals</span>
              <span className="line" />
              <span className="t t--dim">{goalProgress.length} tracked</span>
            </div>
            <div className="goals">
              {goalProgress.length === 0 ? (
                <div className="empty-state empty-state--inline">
                  <span>No goals yet — add some to start tracking progress.</span>
                </div>
              ) : (
                goalProgress.map((gp, i) => (
                  <GoalRow
                    key={gp.goalId ?? `${UNASSIGNED_KEY}${i}`}
                    name={gp.name}
                    done={gp.done}
                    total={gp.total}
                    color={goalColor(i)}
                  />
                ))
              )}
            </div>
          </div>
          <div className="sprint-main-arc">
            <ProgressArc pct={pct} />
            {overall.total > 0 && inWindow && (
              <div className={`arc-pace ${pace < 0 ? 'behind' : ''}`}>{paceLabel}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
