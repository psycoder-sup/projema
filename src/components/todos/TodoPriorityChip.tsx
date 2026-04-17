import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TodoPriority } from '@/types/domain';

interface TodoPriorityChipProps {
  priority: TodoPriority;
  className?: string;
}

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const PRIORITY_CLASSES: Record<TodoPriority, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-red-100 text-red-700 border-red-200',
};

export function TodoPriorityChip({ priority, className }: TodoPriorityChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(PRIORITY_CLASSES[priority], className)}
    >
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
