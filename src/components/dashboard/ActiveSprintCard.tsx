/**
 * Active Sprint dashboard card — Phase 5 (FR-20).
 * Shows sprint name, dates, status badge, per-goal progress bars, and overall progress.
 * Empty state: "No active sprint. Create one and mark it active to start tracking."
 */
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardData } from '@/types/domain';

type ActiveSprintData = NonNullable<DashboardData['activeSprint']>;

interface ActiveSprintCardProps {
  data: DashboardData['activeSprint'];
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
      <div
        className="bg-primary h-2 rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
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
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground truncate max-w-[70%]">{name}</span>
        <span className="text-muted-foreground shrink-0 ml-2">
          {done}/{total}
        </span>
      </div>
      <ProgressBar value={done} max={total} />
    </div>
  );
}

function ActiveSprintContent({ data }: { data: ActiveSprintData }) {
  const { sprint, goalProgress, overall } = data;

  const overallPct =
    overall.total === 0 ? 0 : Math.round((overall.done / overall.total) * 100);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-base truncate">{sprint.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sprint.startDate} → {sprint.endDate}
          </p>
        </div>
        <Badge variant="default" className="shrink-0 bg-green-600 hover:bg-green-600">
          Active
        </Badge>
      </div>

      {/* Overall progress */}
      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Overall</span>
          <span className="text-muted-foreground">
            {overall.done}/{overall.total} ({overallPct}%)
          </span>
        </div>
        <ProgressBar value={overall.done} max={overall.total} />
      </div>

      {/* Per-goal progress */}
      {goalProgress.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Goals
          </p>
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
    <Card className="h-full flex flex-col" aria-label="Active sprint">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Active Sprint</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {data === null ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              No active sprint — plan one to start tracking goals.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/sprints/new">Create sprint</Link>
            </Button>
          </div>
        ) : (
          <ActiveSprintContent data={data} />
        )}
      </CardContent>
    </Card>
  );
}
