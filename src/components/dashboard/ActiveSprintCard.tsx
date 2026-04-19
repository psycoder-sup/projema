/**
 * Active Sprint dashboard card — Phase 5 (FR-20).
 * Brutalist treatment: segmented progress bar, mono dates, acid accent on active.
 */
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardData } from '@/types/domain';

type ActiveSprintData = NonNullable<DashboardData['activeSprint']>;

interface ActiveSprintCardProps {
  data: DashboardData['activeSprint'];
}

function SegmentBar({ done, total }: { done: number; total: number }) {
  const segments = Math.max(total, 1);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex h-4 w-full border-2 border-ink"
    >
      {Array.from({ length: segments }).map((_, i) => {
        const filled = i < done;
        return (
          <div
            key={i}
            className={`flex-1 ${filled ? 'bg-acid' : 'bg-paper'} ${
              i !== segments - 1 ? 'border-r-2 border-ink' : ''
            }`}
          />
        );
      })}
    </div>
  );
}

function GoalProgressRow({
  name,
  done,
  total,
}: {
  name: string;
  done: number;
  total: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-ink">
          {String(done).padStart(2, '0')}/{String(total).padStart(2, '0')}
        </span>
      </div>
      <SegmentBar done={done} total={total} />
    </div>
  );
}

function ActiveSprintContent({ data }: { data: ActiveSprintData }) {
  const { sprint, goalProgress, overall } = data;
  const overallPct = overall.total === 0 ? 0 : Math.round((overall.done / overall.total) * 100);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl uppercase leading-tight text-ink">
            {sprint.name}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {sprint.startDate}
            <span className="mx-1.5 text-ink">→</span>
            {sprint.endDate}
          </p>
        </div>
        <Badge variant="acid" className="shrink-0">
          ● Live
        </Badge>
      </div>

      {/* Overall — big number, inline */}
      <div className="mt-5 border-2 border-ink bg-paper p-4">
        <div className="flex items-baseline justify-between">
          <span className="kicker">Overall</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {overall.done}/{overall.total}
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-display text-5xl leading-none tabular-nums">{overallPct}</span>
          <span className="font-display text-xl leading-none text-muted-foreground">%</span>
        </div>
        <div className="mt-3">
          <SegmentBar done={overall.done} total={Math.max(overall.total, 1)} />
        </div>
      </div>

      {goalProgress.length > 0 && (
        <div className="mt-5 space-y-4">
          <p className="kicker">Goals</p>
          {goalProgress.map((gp) => (
            <GoalProgressRow
              key={gp.goalId ?? '__unassigned__'}
              name={gp.name}
              done={gp.done}
              total={gp.total}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function ActiveSprintCard({ data }: ActiveSprintCardProps) {
  return (
    <Card className="flex h-full flex-col shadow-brut" aria-label="Active sprint">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="kicker">01 —</span>
          <h2 className="font-display text-lg uppercase tracking-tight">Active Sprint</h2>
        </div>
        <span aria-hidden className="h-3 w-3 bg-acid border-2 border-ink" />
      </CardHeader>
      <CardContent className="flex-1">
        {data === null ? (
          <div className="flex flex-col items-start gap-4 py-4">
            <p className="font-display text-2xl uppercase leading-tight text-ink">
              No active sprint.
            </p>
            <p className="font-sans text-sm text-muted-foreground">
              No active sprint — plan one to start tracking goals.
            </p>
            <Button asChild size="sm" variant="acid">
              <Link href="/sprints/new">+ Create sprint</Link>
            </Button>
          </div>
        ) : (
          <ActiveSprintContent data={data} />
        )}
      </CardContent>
    </Card>
  );
}
