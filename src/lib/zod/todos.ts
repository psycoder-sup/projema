/**
 * Zod schemas for todo-related inputs.
 * Phase 3 implementation.
 */
import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const todoStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export const todoPrioritySchema = z.enum(['low', 'medium', 'high']);

// ============================================================================
// todoLinkInputSchema
// ============================================================================

export const todoLinkInputSchema = z.object({
  url: z
    .string()
    .refine(
      (u) => {
        try {
          const parsed = new URL(u);
          return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: 'URL must be a valid http, https, or mailto URL' },
    )
    .refine((u) => u.length <= 2048, { message: 'URL must be 2048 chars or less' }),
  label: z.string().max(140, 'Label must be 140 chars or less').optional().nullable(),
});

export type TodoLinkInput = z.infer<typeof todoLinkInputSchema>;

// ============================================================================
// ISO date helper
// ============================================================================

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date string (YYYY-MM-DD)');

// ============================================================================
// createTodoSchema
// ============================================================================

export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(140, 'Title must be 140 chars or less'),
  description: z.string().max(4000, 'Description must be 4000 chars or less').optional(),
  status: todoStatusSchema.optional(),
  priority: todoPrioritySchema.optional(),
  assigneeUserId: z.string().uuid('Invalid assignee user ID').optional().nullable(),
  dueDate: isoDateString.optional().nullable(),
  sprintId: z.string().uuid('Invalid sprint ID').optional().nullable(),
  sprintGoalId: z.string().uuid('Invalid sprint goal ID').optional().nullable(),
  links: z.array(todoLinkInputSchema).optional(),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;

// ============================================================================
// updateTodoSchema
// NOTE: .optional().nullable() on each nullable field so Zod can represent
// "key present with null" vs "key absent". The action layer then uses
// Object.prototype.hasOwnProperty.call(rawInput, field) to distinguish
// between absent and present-null.
// ============================================================================

export const updateTodoSchema = z.object({
  id: z.string().uuid('Invalid todo ID'),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
  title: z.string().min(1).max(140).optional(),
  description: z.string().max(4000).optional().nullable(),
  status: todoStatusSchema.optional(),
  priority: todoPrioritySchema.optional(),
  assigneeUserId: z.string().uuid('Invalid assignee user ID').optional().nullable(),
  dueDate: isoDateString.optional().nullable(),
  sprintId: z.string().uuid('Invalid sprint ID').optional().nullable(),
  sprintGoalId: z.string().uuid('Invalid sprint goal ID').optional().nullable(),
});

export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

// ============================================================================
// deleteTodoSchema
// ============================================================================

export const deleteTodoSchema = z.object({
  id: z.string().uuid('Invalid todo ID'),
});

export type DeleteTodoInput = z.infer<typeof deleteTodoSchema>;

// ============================================================================
// listTodosInputSchema — typed sprintScope union
// ============================================================================

const sprintScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('any') }),
  z.object({ kind: z.literal('backlog') }),
  z.object({ kind: z.literal('sprint'), sprintId: z.string().uuid() }),
]);

export const listTodosInputSchema = z.object({
  filter: z
    .object({
      assigneeUserId: z.string().uuid().optional(),
      status: todoStatusSchema.optional(),
      priority: todoPrioritySchema.optional(),
      sprintScope: sprintScopeSchema.optional(),
    })
    .optional(),
});

export type ListTodosInput = z.infer<typeof listTodosInputSchema>;
export type SprintScope = z.infer<typeof sprintScopeSchema>;

// ============================================================================
// getTodoDetailSchema
// ============================================================================

export const getTodoDetailSchema = z.object({
  id: z.string().uuid('Invalid todo ID'),
});

export type GetTodoDetailInput = z.infer<typeof getTodoDetailSchema>;

// ============================================================================
// addTodoLinkSchema
// ============================================================================

export const addTodoLinkSchema = z.object({
  todoId: z.string().uuid('Invalid todo ID'),
  url: z
    .string()
    .refine(
      (u) => {
        try {
          const parsed = new URL(u);
          return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: 'URL must be a valid http, https, or mailto URL' },
    )
    .refine((u) => u.length <= 2048, { message: 'URL must be 2048 chars or less' }),
  label: z.string().max(140, 'Label must be 140 chars or less').optional().nullable(),
  position: z.number().int().optional(),
});

export type AddTodoLinkInput = z.infer<typeof addTodoLinkSchema>;

// ============================================================================
// removeTodoLinkSchema
// ============================================================================

export const removeTodoLinkSchema = z.object({
  linkId: z.string().uuid('Invalid link ID'),
});

export type RemoveTodoLinkInput = z.infer<typeof removeTodoLinkSchema>;

// ============================================================================
// saveTodoDocumentSchema
// ============================================================================

export const saveTodoDocumentSchema = z.object({
  todoId: z.string().uuid('Invalid todo ID'),
  contentMarkdown: z
    .string()
    .refine(
      (s) => new TextEncoder().encode(s).length <= 102400,
      { message: 'document_too_large' },
    ),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

export type SaveTodoDocumentInput = z.infer<typeof saveTodoDocumentSchema>;

// ============================================================================
// deleteTodoDocumentSchema
// ============================================================================

export const deleteTodoDocumentSchema = z.object({
  todoId: z.string().uuid('Invalid todo ID'),
});

export type DeleteTodoDocumentInput = z.infer<typeof deleteTodoDocumentSchema>;
