function SkeletonLine({ width = '100%', height = 10 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'var(--bg-3)',
        borderRadius: 4,
      }}
      aria-hidden
    />
  );
}

function DenseSkeletonCard({ rows = 4, span = 1 }: { rows?: number; span?: 1 | 2 }) {
  return (
    <div className={`dense-card${span === 2 ? ' span-2' : ''}`} aria-hidden>
      <div className="card-head">
        <SkeletonLine width={120} height={11} />
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonLine height={12} />
            <SkeletonLine width="60%" height={9} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="dash">
      <div className="dash-title-row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonLine width={280} height={22} />
          <SkeletonLine width={220} height={11} />
        </div>
      </div>
      <div className="grid">
        <DenseSkeletonCard rows={6} span={2} />
        <DenseSkeletonCard rows={5} />
        <DenseSkeletonCard rows={4} />
        <DenseSkeletonCard rows={5} />
      </div>
    </div>
  );
}
