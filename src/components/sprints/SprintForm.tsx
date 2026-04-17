'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SprintGoalList } from './SprintGoalList';
import type { Sprint } from '@/types/domain';
import { createSprint, updateSprint } from '@/server/actions/sprints';
import type { User } from '@/types/domain';

interface SprintFormProps {
  actor: User;
  /** If provided, puts the form in edit mode for an existing sprint. */
  sprint?: Sprint;
}

interface FormErrors {
  name?: string;
  startDate?: string;
  endDate?: string;
  goals?: string;
  general?: string;
}

/**
 * SprintForm — client component for creating or editing a sprint.
 * Handles name, startDate, endDate, and goals list.
 * Inline validation: end >= start, unique goal names (case-insensitive).
 */
export function SprintForm({ actor, sprint }: SprintFormProps) {
  const router = useRouter();
  const isEdit = Boolean(sprint);

  const [name, setName] = useState(sprint?.name ?? '');
  const [startDate, setStartDate] = useState(sprint?.startDate ?? '');
  const [endDate, setEndDate] = useState(sprint?.endDate ?? '');
  const [goals, setGoals] = useState<Array<{ id?: string | undefined; name: string }>>(
    sprint?.goals.map((g) => ({ id: g.id, name: g.name })) ?? [],
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'Name is required';
    else if (name.length > 140) errs.name = 'Name must be 140 characters or less';

    if (!startDate) errs.startDate = 'Start date is required';
    if (!endDate) errs.endDate = 'End date is required';
    else if (startDate && endDate < startDate) {
      errs.endDate = 'End date must be on or after start date';
    }

    const goalNames = goals.map((g) => g.name.toLowerCase());
    if (new Set(goalNames).size !== goalNames.length) {
      errs.goals = 'Goal names must be unique (case-insensitive)';
    }
    if (goals.some((g) => !g.name.trim())) {
      errs.goals = 'Goal names cannot be empty';
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      let result;
      if (isEdit && sprint) {
        result = await updateSprint(
          {
            id: sprint.id,
            name,
            startDate,
            endDate,
            goalsUpsert: goals.map((g) =>
              g.id !== undefined ? { id: g.id, name: g.name } : { name: g.name },
            ),
          },
          { actor },
        );
      } else {
        result = await createSprint(
          {
            name,
            startDate,
            endDate,
            goals: goals.map((g) => g.name),
          },
          { actor },
        );
      }

      if (result.ok) {
        router.push(`/sprints/${result.data.sprint.id}`);
        router.refresh();
      } else {
        const errorCode = result.error.code;
        if (errorCode === 'validation_failed' && 'field' in result.error && result.error.field) {
          setErrors({ [result.error.field]: result.error.message });
        } else {
          setErrors({ general: result.error.message });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const hasErrors = Object.keys(validate()).length > 0;
  const isSaveDisabled = loading || hasErrors;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      {/* Name */}
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Sprint name <span className="text-destructive">*</span>
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Sprint 42"
          maxLength={140}
          disabled={loading}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            Start date <span className="text-destructive">*</span>
          </label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
          />
          {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="endDate" className="text-sm font-medium">
            End date <span className="text-destructive">*</span>
          </label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            disabled={loading}
          />
          {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
        </div>
      </div>

      {/* Goals */}
      <SprintGoalList goals={goals} onChange={setGoals} error={errors.goals} />

      {errors.general && (
        <p className="text-sm text-destructive">{errors.general}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSaveDisabled}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create sprint'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
