'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTodo } from '@/server/actions/todos';
import type { User, TodoStatus, TodoPriority } from '@/types/domain';

interface TodoFormProps {
  actor: User;
  sprintId?: string;
  sprintGoalId?: string;
  onSuccess?: (todoId: string) => void;
  onCancel?: () => void;
}

export function TodoForm({ actor, sprintId, sprintGoalId, onSuccess, onCancel }: TodoFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TodoStatus>('todo');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createTodo(
        {
          title,
          description: description || undefined,
          status,
          priority,
          sprintId: sprintId ?? null,
          sprintGoalId: sprintGoalId ?? null,
        },
        { actor },
      );

      if (res.ok) {
        onSuccess?.(res.data.todo.id);
      } else {
        setError(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="todo-title" className="block text-sm font-medium mb-1">
          Title <span className="text-destructive">*</span>
        </label>
        <Input
          id="todo-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Todo title…"
          maxLength={140}
          required
        />
      </div>

      <div>
        <label htmlFor="todo-desc" className="block text-sm font-medium mb-1">
          Description
        </label>
        <Textarea
          id="todo-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description…"
          rows={3}
          maxLength={4000}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as TodoStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TodoPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending || !title.trim()}>
          {isPending ? 'Creating…' : 'Create Todo'}
        </Button>
      </div>
    </form>
  );
}
