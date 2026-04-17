'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TodoForm } from './TodoForm';
import type { User } from '@/types/domain';

interface NewTodoButtonProps {
  actor: User;
  sprintId?: string;
  sprintGoalId?: string;
  label?: string;
}

export function NewTodoButton({ actor, sprintId, sprintGoalId, label = 'New todo' }: NewTodoButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{label}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New todo</DialogTitle>
        </DialogHeader>
        <TodoForm
          actor={actor}
          {...(sprintId ? { sprintId } : {})}
          {...(sprintGoalId ? { sprintGoalId } : {})}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
