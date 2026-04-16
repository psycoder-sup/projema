/**
 * Zod schemas for todo-related inputs.
 * Phase 3 implementation — Phase 0 stub only.
 */
import { z } from 'zod';

// Phase 3: implement full schemas
export const todoStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export const todoPrioritySchema = z.enum(['low', 'medium', 'high']);

export const createTodoSchema = z.object({
  title: z.string().min(1).max(140),
  description: z.string().max(4000).optional(),
  status: todoStatusSchema.optional(),
  priority: todoPrioritySchema.optional(),
  assigneeUserId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(), // ISO date string
  sprintId: z.string().optional().nullable(),
  sprintGoalId: z.string().optional().nullable(),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
