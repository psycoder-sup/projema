/**
 * Mapper functions to convert Prisma Sprint rows to domain Sprint types.
 * Uses toIsoDate for date-typed columns (stored as Date in Prisma, string in domain).
 */
import { toIsoDate } from '@/lib/utils/date';
import type { Sprint, SprintGoal, SprintStatus } from '@/types/domain';

type PrismaSprintGoalRow = {
  id: string;
  sprintId: string;
  name: string;
  position: number;
  createdAt: Date;
};

type PrismaSprintRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  createdByUserId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Map a Prisma SprintGoal row to the domain SprintGoal type.
 */
export function mapSprintGoalRow(row: PrismaSprintGoalRow): SprintGoal {
  return {
    id: row.id,
    sprintId: row.sprintId,
    name: row.name,
    position: row.position,
    createdAt: row.createdAt,
  };
}

/**
 * Map a Prisma Sprint row (with Date start/end) to the domain Sprint type.
 * @param row - The raw Prisma Sprint row.
 * @param goals - The associated goals (already fetched or empty array).
 */
export function mapSprintRow(row: PrismaSprintRow, goals: PrismaSprintGoalRow[]): Sprint {
  return {
    id: row.id,
    name: row.name,
    // Prisma returns date-typed columns as JS Date; domain uses ISO string
    startDate: toIsoDate(row.startDate) ?? row.startDate.toISOString().substring(0, 10),
    endDate: toIsoDate(row.endDate) ?? row.endDate.toISOString().substring(0, 10),
    status: row.status as SprintStatus,
    createdByUserId: row.createdByUserId,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    goals: goals.map(mapSprintGoalRow),
  };
}
