/**
 * getDashboardData — plain async server function (not a server action).
 * Returns DashboardData raw (not wrapped in Result<T,E>).
 * See SPEC §3, §7, §10.
 *
 * All four sub-queries run in parallel via Promise.all.
 * Performance target: ≤ 500ms p95 combined (SPEC §10).
 */
import { prisma } from '@/server/db/client';
import { mapTodoRow } from './todo-mappers';
import { mapSprintRow } from './sprint-mappers';
import type { DashboardData, ActivityEvent, ActivityEventKind, Todo, User } from '@/types/domain';

// ============================================================================
// Activity mapper (avoids importing the server action which has 'use server')
// ============================================================================

type PrismaActivityRow = {
  id: string;
  actorUserId: string;
  kind: string;
  targetTodoId: string | null;
  targetSprintId: string | null;
  payloadJson: unknown;
  createdAt: Date;
};

function mapActivityRow(raw: PrismaActivityRow): ActivityEvent {
  return {
    id: raw.id,
    actorUserId: raw.actorUserId,
    kind: raw.kind as ActivityEventKind,
    targetTodoId: raw.targetTodoId,
    targetSprintId: raw.targetSprintId,
    payload: raw.payloadJson != null ? (raw.payloadJson as Record<string, unknown>) : null,
    createdAt: raw.createdAt,
  };
}

// ============================================================================
// getDashboardData
// ============================================================================

export async function getDashboardData(ctx: { actor: User }): Promise<DashboardData> {
  const actorId = ctx.actor.id;

  // ── Run all four sections in parallel ─────────────────────────────────────
  const [activeSprintRow, myTodosRows, upcomingRows, activityRows] = await Promise.all([
    // 1. Active sprint — LIMIT 1
    prisma.sprint.findFirst({
      where: { status: 'active' },
      include: {
        goals: {
          orderBy: { position: 'asc' },
        },
      },
    }),

    // 2. My Todos — assignee = actor, status != done, ORDER BY due_date ASC NULLS LAST, created_at DESC, LIMIT 10
    // Prisma doesn't natively support NULLS LAST ordering, so we use $queryRaw.
    // Using type-safe tagged template literal.
    prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        assignee_user_id: string | null;
        due_date: Date | null;
        sprint_id: string | null;
        sprint_goal_id: string | null;
        created_by_user_id: string;
        completed_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT
        id,
        title,
        description,
        status,
        priority,
        assignee_user_id,
        due_date,
        sprint_id,
        sprint_goal_id,
        created_by_user_id,
        completed_at,
        created_at,
        updated_at
      FROM todos
      WHERE assignee_user_id = ${actorId}::uuid
        AND status != 'done'
      ORDER BY due_date ASC NULLS LAST, created_at DESC
      LIMIT 10
    `,

    // 3. Upcoming deadlines — due within 7 days, status != done, cap 15
    prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        assignee_user_id: string | null;
        due_date: Date | null;
        sprint_id: string | null;
        sprint_goal_id: string | null;
        created_by_user_id: string;
        completed_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT
        id,
        title,
        description,
        status,
        priority,
        assignee_user_id,
        due_date,
        sprint_id,
        sprint_goal_id,
        created_by_user_id,
        completed_at,
        created_at,
        updated_at
      FROM todos
      WHERE status != 'done'
        AND due_date IS NOT NULL
        AND due_date <= (CURRENT_DATE + INTERVAL '7 days')
      ORDER BY due_date ASC
      LIMIT 15
    `,

    // 4. Last 15 activity events — newest first
    prisma.activityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  // ── Map raw SQL todo rows to domain Todo (no links/document on dashboard) ──
  function mapRawTodoRow(raw: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignee_user_id: string | null;
    due_date: Date | null;
    sprint_id: string | null;
    sprint_goal_id: string | null;
    created_by_user_id: string;
    completed_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): Todo {
    return mapTodoRow({
      id: raw.id,
      title: raw.title,
      description: raw.description,
      status: raw.status,
      priority: raw.priority,
      assigneeUserId: raw.assignee_user_id,
      dueDate: raw.due_date,
      sprintId: raw.sprint_id,
      sprintGoalId: raw.sprint_goal_id,
      createdByUserId: raw.created_by_user_id,
      completedAt: raw.completed_at,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      links: [],
      document: null,
    });
  }

  const myTodos: Todo[] = myTodosRows.map(mapRawTodoRow);
  const upcomingDeadlines: Todo[] = upcomingRows.map(mapRawTodoRow);
  const activity: ActivityEvent[] = activityRows.map(mapActivityRow);

  // ── Build activeSprint with goal-progress aggregates ──────────────────────
  if (!activeSprintRow) {
    return {
      activeSprint: null,
      myTodos,
      upcomingDeadlines,
      activity,
    };
  }

  // Fetch per-goal progress rollup using raw SQL for the FILTER aggregate.
  // Groups by sprint_goal_id (including null = "Unassigned to goal").
  const progressRows = await prisma.$queryRaw<
    Array<{
      sprint_goal_id: string | null;
      total: bigint;
      done: bigint;
    }>
  >`
    SELECT
      sprint_goal_id,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'done') AS done
    FROM todos
    WHERE sprint_id = ${activeSprintRow.id}::uuid
    GROUP BY sprint_goal_id
  `;

  // Build a lookup: goalId → { done, total }
  const progressByGoalId = new Map<string | null, { done: number; total: number }>();
  for (const row of progressRows) {
    progressByGoalId.set(row.sprint_goal_id, {
      done: Number(row.done),
      total: Number(row.total),
    });
  }

  // Build goalProgress array: one entry per named goal + one "Unassigned to goal" if needed
  const goalProgress: Array<{ goalId: string | null; name: string; done: number; total: number }> =
    [];

  for (const goal of activeSprintRow.goals) {
    const p = progressByGoalId.get(goal.id) ?? { done: 0, total: 0 };
    goalProgress.push({
      goalId: goal.id,
      name: goal.name,
      done: p.done,
      total: p.total,
    });
  }

  // Include "Unassigned to goal" row if there are todos with sprint_goal_id = null
  const unassigned = progressByGoalId.get(null);
  if (unassigned && unassigned.total > 0) {
    goalProgress.push({
      goalId: null,
      name: 'Unassigned to goal',
      done: unassigned.done,
      total: unassigned.total,
    });
  }

  // Compute overall totals
  let overallDone = 0;
  let overallTotal = 0;
  for (const row of progressRows) {
    overallDone += Number(row.done);
    overallTotal += Number(row.total);
  }

  const sprint = mapSprintRow(activeSprintRow, activeSprintRow.goals);

  return {
    activeSprint: {
      sprint,
      goalProgress,
      overall: { done: overallDone, total: overallTotal },
    },
    myTodos,
    upcomingDeadlines,
    activity,
  };
}
