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

const PRIORITY_VARIANT: Record<TodoPriority, 'outline' | 'secondary' | 'destructive'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'destructive',
};

export function TodoPriorityChip({ priority, className }: TodoPriorityChipProps) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} className={cn(className)}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
