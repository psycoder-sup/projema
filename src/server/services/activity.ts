/**
 * Activity event service.
 * Writes activity_events rows inside the caller's transaction for atomicity.
 */
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { ActivityEventKind } from '@/types/domain';

type TxClient = PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Record an activity event inside an existing transaction.
 *
 * @param tx  - The Prisma transaction client (or root client for non-txn use).
 * @param input - The activity event data.
 */
export async function recordActivity(
  tx: TxClient,
  input: {
    actorUserId: string;
    kind: ActivityEventKind;
    targetTodoId?: string;
    targetSprintId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const payloadJson = input.payload != null
    ? (input.payload as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  await (tx as PrismaClient).activityEvent.create({
    data: {
      actorUserId: input.actorUserId,
      kind: input.kind,
      targetTodoId: input.targetTodoId ?? null,
      targetSprintId: input.targetSprintId ?? null,
      payloadJson,
    },
  });
}
