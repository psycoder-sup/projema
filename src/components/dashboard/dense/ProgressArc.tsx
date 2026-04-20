'use client';

import { useEffect, useState } from 'react';

interface ProgressArcProps {
  pct: number;
  size?: number;
  stroke?: number;
}

export function ProgressArc({ pct, size = 180, stroke = 12 }: ProgressArcProps) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (animated / 100);

  return (
    <div className="arc-wrap" style={{ width: size, height: size }}>
      <svg className="arc-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="arc-bg"
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="arc-fg"
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c - dash}
        />
        {[0, 25, 50, 75].map((p) => {
          const a = (p / 100) * 2 * Math.PI;
          const x1 = size / 2 + (r - stroke / 2 - 2) * Math.cos(a);
          const y1 = size / 2 + (r - stroke / 2 - 2) * Math.sin(a);
          const x2 = size / 2 + (r + stroke / 2 + 2) * Math.cos(a);
          const y2 = size / 2 + (r + stroke / 2 + 2) * Math.sin(a);
          return <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-2)" strokeWidth={1} />;
        })}
      </svg>
      <div className="arc-center">
        <div>
          <div className="arc-pct">
            <span className="sr-only">
              {Math.round(animated)} percent complete — sprint progress
            </span>
            <span aria-hidden="true">
              {Math.round(animated)}
              <span className="pct">%</span>
            </span>
          </div>
          <div className="arc-label" aria-hidden="true">Sprint complete</div>
        </div>
      </div>
    </div>
  );
}
