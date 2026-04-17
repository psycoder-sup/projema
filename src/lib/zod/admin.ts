/**
 * Zod schemas for admin server actions.
 */
import { z } from 'zod';

export const addAllowlistEmailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Must be a valid email address')
    .transform((v) => v.toLowerCase()),
});

export const removeAllowlistEmailSchema = z.object({
  entryId: z.string().min(1, 'Entry ID is required'),
});

export const deactivateUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export type AddAllowlistEmailInput = z.infer<typeof addAllowlistEmailSchema>;
export type RemoveAllowlistEmailInput = z.infer<typeof removeAllowlistEmailSchema>;
export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;
