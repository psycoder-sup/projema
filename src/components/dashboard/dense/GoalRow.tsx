'use client';

import { useEffect, useState, type CSSProperties } from 'react';

interface GoalRowProps {
  name: string;
  done: number;
  total: number;
  color: string;
}

export function GoalRow({ name, done, total, color }: GoalRowProps) {
  const target = total === 0 ? 0 : done / total;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(target), 200);
    return () => clearTimeout(t);
  }, [target]);

  const styleVars: CSSProperties = {
    ['--c' as string]: color,
    ['--p' as string]: animated,
  };

  return (
    <div className="goal" style={styleVars}>
      <div className="goal-marker" />
      <div className="goal-name">
        <div className="t">{name}</div>
        <div className="goal-bar-wrap">
          <div className="goal-bar" />
        </div>
      </div>
      <div className="goal-counts">
        <span className="pct">{Math.round(target * 100)}%</span>
        <span className="of">
          {done}/{total}
        </span>
      </div>
    </div>
  );
}
