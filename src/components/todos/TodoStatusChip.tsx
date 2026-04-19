import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TodoStatus } from '@/types/domain';

interface TodoStatusChipProps {
  status: TodoStatus;
  className?: string;
}

const STATUS_LABELS: Record<TodoStatus, string> = {
  todo: 'Todo',
  in_progress: 'Doing',
  done: 'Done',
};

const STATUS_VARIANT: Record<TodoStatus, 'secondary' | 'acid' | 'outline'> = {
  todo: 'secondary',
  in_progress: 'acid',
  done: 'outline',
};

export function TodoStatusChip({ status, className }: TodoStatusChipProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn(className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
