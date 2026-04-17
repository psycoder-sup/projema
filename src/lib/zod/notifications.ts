/**
 * Zod schemas for notification-related inputs.
 * Phase 6 implementation.
 */
import { z } from 'zod';

export const listNotificationsSchema = z.object({});

export const markNotificationReadSchema = z.object({
  id: z.string().uuid('Notification id must be a valid UUID'),
});

export const markAllNotificationsReadSchema = z.object({
  upToCreatedAt: z
    .string()
    .datetime({ message: 'upToCreatedAt must be an ISO datetime string' }),
});
