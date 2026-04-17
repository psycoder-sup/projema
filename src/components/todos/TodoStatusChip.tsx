import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TodoStatus } from '@/types/domain';

interface TodoStatusChipProps {
  status: TodoStatus;
  className?: string;
}

const STATUS_LABELS: Record<TodoStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

const STATUS_CLASSES: Record<TodoStatus, string> = {
  todo: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  done: 'bg-green-100 text-green-700 border-green-200',
};

export function TodoStatusChip({ status, className }: TodoStatusChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_CLASSES[status], className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
