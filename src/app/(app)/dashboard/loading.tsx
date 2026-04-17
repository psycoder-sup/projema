/**
 * Dashboard loading skeleton — Phase 5 (FR-20).
 * Renders skeleton cards while getDashboardData resolves.
 * Target: visible for ≤ 800ms per PRD §6.
 */
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function SkeletonCard({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pt-0">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-4 lg:gap-6">
        <div className="lg:row-start-1 lg:col-start-1">
          <SkeletonCard rows={5} />
        </div>
        <div className="lg:row-start-1 lg:col-start-2">
          <SkeletonCard rows={4} />
        </div>
        <div className="lg:row-start-2 lg:col-start-1">
          <SkeletonCard rows={3} />
        </div>
        <div className="lg:row-start-2 lg:col-start-2">
          <SkeletonCard rows={4} />
        </div>
      </div>
    </div>
  );
}
