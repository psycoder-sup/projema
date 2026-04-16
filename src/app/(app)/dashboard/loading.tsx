/**
 * Dashboard loading skeleton.
 * Phase 5 implementation — Phase 0 stub only.
 */
export default function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
