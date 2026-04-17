'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Goal {
  id?: string | undefined;
  name: string;
}

interface SprintGoalListProps {
  goals: Goal[];
  onChange: (goals: Goal[]) => void;
  error?: string | undefined;
}

/**
 * SprintGoalList — inline list editor for sprint goals.
 * Allows adding, editing, and removing goals.
 */
export function SprintGoalList({ goals, onChange, error }: SprintGoalListProps) {
  const [newGoalName, setNewGoalName] = useState('');

  function handleAdd() {
    const trimmed = newGoalName.trim();
    if (!trimmed) return;
    // Check for duplicate (case-insensitive)
    if (goals.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...goals, { name: trimmed }]);
    setNewGoalName('');
  }

  function handleRemove(idx: number) {
    onChange(goals.filter((_, i) => i !== idx));
  }

  function handleEdit(idx: number, name: string) {
    onChange(goals.map((g, i) => (i === idx ? { ...g, name } : g)));
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">Goals</div>
      {goals.map((goal, idx) => (
        <div key={goal.id ?? `new-${idx}`} className="flex items-center gap-2">
          <Input
            value={goal.name}
            onChange={(e) => handleEdit(idx, e.target.value)}
            placeholder="Goal name"
            maxLength={140}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleRemove(idx)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove goal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={newGoalName}
          onChange={(e) => setNewGoalName(e.target.value)}
          placeholder="Add a goal…"
          maxLength={140}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newGoalName.trim()}
        >
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
