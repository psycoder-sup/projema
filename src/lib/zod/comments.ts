/**
 * Zod schemas for comment-related inputs.
 * Phase 4 implementation.
 */
import { z } from 'zod';

// ============================================================================
// postCommentSchema
// ============================================================================

export const postCommentSchema = z.object({
  todoId: z.string().uuid('Invalid todo ID'),
  body: z.string().min(1, 'Comment body is required').max(2000, 'Comment body must be 2000 chars or less'),
});

export type PostCommentInput = z.infer<typeof postCommentSchema>;

// ============================================================================
// editCommentSchema
// ============================================================================

export const editCommentSchema = z.object({
  id: z.string().uuid('Invalid comment ID'),
  body: z.string().min(1, 'Comment body is required').max(2000, 'Comment body must be 2000 chars or less'),
});

export type EditCommentInput = z.infer<typeof editCommentSchema>;

// ============================================================================
// deleteCommentSchema
// ============================================================================

export const deleteCommentSchema = z.object({
  id: z.string().uuid('Invalid comment ID'),
});

export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;

// ============================================================================
// listCommentsSchema
// ============================================================================

export const listCommentsSchema = z.object({
  todoId: z.string().uuid('Invalid todo ID'),
});

export type ListCommentsInput = z.infer<typeof listCommentsSchema>;
