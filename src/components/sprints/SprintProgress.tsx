'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

interface SprintProgressProps {
  done: number;
  total: number;
  className?: string;
}

/**
 * SprintProgress — progress bar for a sprint.
 * Shows done/total counts and a visual bar.
 * Phase 5 will add full aggregate; Phase 2 uses simple counts.
 */
export function SprintProgress({ done, total, className }: SprintProgressProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {done} / {total} done
        </span>
        <span>{pct}%</span>
      </div>
      <ProgressPrimitive.Root
        className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
        value={pct}
      >
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}
