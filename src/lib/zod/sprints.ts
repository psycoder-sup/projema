/**
 * Zod schemas for sprint-related inputs.
 * Phase 2 implementation.
 */
import { z } from 'zod';

// ============================================================================
// Sprint status enum
// ============================================================================

export const sprintStatusSchema = z.enum(['planned', 'active', 'completed']);

// ============================================================================
// ISO date string helper
// ============================================================================

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date string (YYYY-MM-DD)');

// ============================================================================
// createSprintSchema
// ============================================================================

export const createSprintSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(140, 'Name must be 140 chars or less'),
    startDate: isoDateString,
    endDate: isoDateString,
    goals: z
      .array(z.string().min(1, 'Goal name is required').max(140, 'Goal name must be 140 chars or less'))
      .default([])
      .refine(
        (goals) => {
          const lower = goals.map((g) => g.toLowerCase());
          return new Set(lower).size === lower.length;
        },
        {
          message: 'Goal names must be unique (case-insensitive)',
          path: ['goals'],
        },
      ),
  })
  .refine(
    (data) => data.endDate >= data.startDate,
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    },
  );

export type CreateSprintInput = z.infer<typeof createSprintSchema>;

// ============================================================================
// updateSprintSchema
// ============================================================================

export const updateSprintSchema = z.object({
  id: z.string().min(1, 'Sprint ID is required'),
  name: z.string().min(1).max(140).optional(),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
  goalsUpsert: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(140),
      }),
    )
    .optional(),
});

export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;

// ============================================================================
// activateSprintSchema
// ============================================================================

export const activateSprintSchema = z.object({
  id: z.string().min(1, 'Sprint ID is required'),
  acknowledgedCompletingId: z.string().optional(),
});

export type ActivateSprintInput = z.infer<typeof activateSprintSchema>;

// ============================================================================
// completeSprintSchema
// ============================================================================

export const completeSprintSchema = z.object({
  id: z.string().min(1, 'Sprint ID is required'),
});

export type CompleteSprintInput = z.infer<typeof completeSprintSchema>;

// ============================================================================
// deleteSprintSchema
// ============================================================================

export const deleteSprintSchema = z.object({
  id: z.string().min(1, 'Sprint ID is required'),
});

export type DeleteSprintInput = z.infer<typeof deleteSprintSchema>;

// ============================================================================
// deleteSprintGoalSchema
// ============================================================================

export const deleteSprintGoalSchema = z.object({
  goalId: z.string().min(1, 'Goal ID is required'),
  strategy: z.enum(['detach_todos', 'cancel']),
});

export type DeleteSprintGoalInput = z.infer<typeof deleteSprintGoalSchema>;

// ============================================================================
// listSprintsInputSchema
// ============================================================================

export const listSprintsInputSchema = z.object({
  status: sprintStatusSchema.optional(),
});

export type ListSprintsInput = z.infer<typeof listSprintsInputSchema>;

// ============================================================================
// getSprintDetailSchema
// ============================================================================

export const getSprintDetailSchema = z.object({
  id: z.string().min(1, 'Sprint ID is required'),
});

export type GetSprintDetailInput = z.infer<typeof getSprintDetailSchema>;
