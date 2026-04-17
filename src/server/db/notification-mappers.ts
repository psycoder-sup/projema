/**
 * Mapper functions to convert Prisma Notification rows to domain Notification types.
 * Phase 6 implementation.
 */
import type { Notification, NotificationKind } from '@/types/domain';

type PrismaNotificationRow = {
  id: string;
  userId: string;
  kind: string;
  targetTodoId: string;
  triggeredByUserId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function mapNotificationRow(raw: PrismaNotificationRow): Notification {
  return {
    id: raw.id,
    userId: raw.userId,
    kind: raw.kind as NotificationKind,
    targetTodoId: raw.targetTodoId,
    triggeredByUserId: raw.triggeredByUserId,
    readAt: raw.readAt,
    createdAt: raw.createdAt,
  };
}
