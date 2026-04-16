/**
 * Zod schemas for comment-related inputs.
 * Phase 4 implementation — Phase 0 stub only.
 */
import { z } from 'zod';

// Phase 4: implement full schemas
export const postCommentSchema = z.object({
  todoId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export type PostCommentInput = z.infer<typeof postCommentSchema>;
