/**
 * Zod schemas for sprint-related inputs.
 * Phase 2 implementation — Phase 0 stub only.
 */
import { z } from 'zod';

// Phase 2: implement full schemas
export const createSprintSchema = z.object({
  name: z.string().min(1).max(140),
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  goals: z.array(z.string().min(1).max(140)).optional(),
});

export type CreateSprintInput = z.infer<typeof createSprintSchema>;
