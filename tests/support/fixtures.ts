/**
 * Test fixtures for integration and unit tests.
 * Uses the Prisma client configured via environment variables.
 *
 * IMPORTANT: Call resetDbClient() after setting DATABASE_URL in beforeAll,
 * then access the db via getDb() or the exported fixture functions.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import type { User, Sprint, SprintGoal, Todo, TodoLink, TodoDocument, Comment, ActivityEvent, ActivityEventKind } from '@/types/domain';
import { toIsoDate } from '@/lib/utils/date';

// Lazy client — created on first access so that beforeAll can set DATABASE_URL first.
let _db: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!_db) {
    _db = new PrismaClient();
  }
  return _db;
}

/**
 * Reset the lazy client. Call this after DATABASE_URL changes in beforeAll
 * so the next getDb() call creates a fresh client with the new URL.
 */
export function resetDbClient(): void {
  if (_db) {
    void _db.$disconnect();
    _db = undefined;
  }
}

/**
 * Truncate all tables in dependency order so each test starts fresh.
 */
export async function resetDb(): Promise<void> {
  const client = getDb();
  // Delete in dependency order: children before parents
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      rate_limit_buckets,
      comments,
      activity_events,
      sessions_log,
      allowlist_entries,
      sessions,
      accounts,
      verification_tokens,
      todo_documents,
      todo_links,
      todos,
      sprint_goals,
      sprints,
      users
    CASCADE
  `);
}

let adminCounter = 0;
let memberCounter = 0;

/**
 * Create a user with role='admin'.
 */
export async function createAdmin(email?: string): Promise<User> {
  adminCounter++;
  const resolvedEmail = email ?? `admin-${adminCounter}@example.com`;
  const raw = await getDb().user.create({
    data: {
      email: resolvedEmail,
      displayName: `Admin ${adminCounter}`,
      avatarUrl: null,
      role: 'admin',
      isActive: true,
    },
  });
  return mapUser(raw);
}

/**
 * Create a user with role='member'.
 */
export async function createMember(email?: string): Promise<User> {
  memberCounter++;
  const resolvedEmail = email ?? `member-${memberCounter}@example.com`;
  const raw = await getDb().user.create({
    data: {
      email: resolvedEmail,
      displayName: `Member ${memberCounter}`,
      avatarUrl: null,
      role: 'member',
      isActive: true,
    },
  });
  return mapUser(raw);
}

/**
 * Insert an allowlist_entries row.
 */
export async function seedAllowlist(email: string, addedByUserId: string): Promise<void> {
  await getDb().allowlistEntry.create({
    data: {
      email: email.toLowerCase(),
      addedByUserId,
    },
  });
}

/**
 * Insert a sessions_log row.
 */
export async function seedSessionLog({
  userId,
  provider,
  createdAt,
}: {
  userId: string;
  provider: 'google' | 'github';
  createdAt?: Date;
}): Promise<void> {
  await getDb().sessionsLog.create({
    data: {
      userId,
      provider,
      createdAt: createdAt ?? new Date(),
    },
  });
}

/**
 * Deactivate a user by setting isActive=false.
 */
export async function deactivateUser(user: User): Promise<void> {
  await getDb().user.update({
    where: { id: user.id },
    data: { isActive: false },
  });
}

// ============================================================================
// Sprint fixtures
// ============================================================================

function todayISO(): string {
  return new Date().toISOString().substring(0, 10);
}

function addDays(n: number, from?: string): string {
  const base = from ? new Date(from) : new Date();
  base.setDate(base.getDate() + n);
  return base.toISOString().substring(0, 10);
}

/**
 * Create a Sprint row (with optional goals).
 * Returns the domain Sprint with goals attached.
 */
export async function seedSprint(
  overrides: {
    name?: string;
    startDate?: string;
    endDate?: string;
    status?: 'planned' | 'active' | 'completed';
    withGoals?: string[];
    createdByUserId?: string;
    completedAt?: Date | null;
  } = {}
): Promise<Sprint & { goals: SprintGoal[] }> {
  const db = getDb();

  // Ensure at least one user exists to use as creator
  let createdByUserId = overrides.createdByUserId;
  if (!createdByUserId) {
    const anyUser = await db.user.findFirst();
    if (anyUser) {
      createdByUserId = anyUser.id;
    } else {
      const u = await createMember(`sprint-creator-${Date.now()}@fixture.test`);
      createdByUserId = u.id;
    }
  }

  const startDate = overrides.startDate ?? todayISO();
  const endDate = overrides.endDate ?? addDays(14, startDate);
  const status = overrides.status ?? 'planned';
  const name = overrides.name ?? `Test Sprint ${Date.now()}`;
  const goalNames = overrides.withGoals ?? [];

  const completedAt =
    overrides.completedAt !== undefined
      ? overrides.completedAt
      : status === 'completed'
        ? new Date()
        : null;

  const rawSprint = await db.sprint.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status,
      createdByUserId,
      completedAt,
    },
  });

  const goals: SprintGoal[] = [];
  for (let i = 0; i < goalNames.length; i++) {
    const rawGoal = await db.sprintGoal.create({
      data: {
        sprintId: rawSprint.id,
        name: goalNames[i]!,
        position: i,
      },
    });
    goals.push({
      id: rawGoal.id,
      sprintId: rawGoal.sprintId,
      name: rawGoal.name,
      position: rawGoal.position,
      createdAt: rawGoal.createdAt,
    });
  }

  return {
    id: rawSprint.id,
    name: rawSprint.name,
    startDate: toIsoDate(rawSprint.startDate) ?? startDate,
    endDate: toIsoDate(rawSprint.endDate) ?? endDate,
    status: rawSprint.status as 'planned' | 'active' | 'completed',
    createdByUserId: rawSprint.createdByUserId,
    completedAt: rawSprint.completedAt,
    createdAt: rawSprint.createdAt,
    updatedAt: rawSprint.updatedAt,
    goals,
  };
}

/**
 * Create a Todo row (with optional description, completedAt, etc.).
 * Returns the domain Todo with links + document (both empty/null by default).
 */
export async function seedTodo(
  overrides: {
    title?: string;
    description?: string | null;
    status?: 'todo' | 'in_progress' | 'done';
    priority?: 'low' | 'medium' | 'high';
    sprintId?: string | null;
    sprintGoalId?: string | null;
    assigneeUserId?: string | null;
    dueDate?: string | null;
    createdByUserId?: string;
    completedAt?: Date | null;
  } = {}
): Promise<Todo> {
  const db = getDb();

  let createdByUserId = overrides.createdByUserId;
  if (!createdByUserId) {
    const anyUser = await db.user.findFirst();
    if (anyUser) {
      createdByUserId = anyUser.id;
    } else {
      const u = await createMember(`todo-creator-${Date.now()}@fixture.test`);
      createdByUserId = u.id;
    }
  }

  const rawTodo = await db.todo.create({
    data: {
      title: overrides.title ?? `Test Todo ${Date.now()}`,
      description: overrides.description ?? null,
      status: overrides.status ?? 'todo',
      priority: overrides.priority ?? 'medium',
      sprintId: overrides.sprintId ?? null,
      sprintGoalId: overrides.sprintGoalId ?? null,
      assigneeUserId: overrides.assigneeUserId ?? null,
      dueDate: overrides.dueDate ? new Date(overrides.dueDate) : null,
      createdByUserId,
      completedAt: overrides.completedAt ?? null,
    },
  });

  return {
    id: rawTodo.id,
    title: rawTodo.title,
    description: rawTodo.description,
    status: rawTodo.status as 'todo' | 'in_progress' | 'done',
    priority: rawTodo.priority as 'low' | 'medium' | 'high',
    assigneeUserId: rawTodo.assigneeUserId,
    dueDate: toIsoDate(rawTodo.dueDate),
    sprintId: rawTodo.sprintId,
    sprintGoalId: rawTodo.sprintGoalId,
    createdByUserId: rawTodo.createdByUserId,
    completedAt: rawTodo.completedAt,
    createdAt: rawTodo.createdAt,
    updatedAt: rawTodo.updatedAt,
    links: [],
    document: null,
  };
}

/**
 * Create a TodoLink row.
 */
export async function seedTodoLink({
  todoId,
  url,
  label,
  position,
}: {
  todoId: string;
  url: string;
  label?: string | null;
  position?: number;
}): Promise<TodoLink> {
  const db = getDb();
  const raw = await db.todoLink.create({
    data: {
      todoId,
      url,
      label: label ?? null,
      position: position ?? 0,
    },
  });
  return {
    id: raw.id,
    todoId: raw.todoId,
    url: raw.url,
    label: raw.label,
    position: raw.position,
  };
}

/**
 * Create a TodoDocument row.
 */
export async function seedTodoDocument({
  todoId,
  contentMarkdown,
  updatedByUserId,
}: {
  todoId: string;
  contentMarkdown: string;
  updatedByUserId: string;
}): Promise<TodoDocument> {
  const db = getDb();
  const raw = await db.todoDocument.upsert({
    where: { todoId },
    create: {
      todoId,
      contentMarkdown,
      updatedByUserId,
    },
    update: {
      contentMarkdown,
      updatedByUserId,
    },
  });
  return {
    todoId: raw.todoId,
    contentMarkdown: raw.contentMarkdown,
    updatedAt: raw.updatedAt,
    updatedByUserId: raw.updatedByUserId,
  };
}

/**
 * Create a goal with N todos attached to it, in a planned sprint.
 * Returns the goal with sprintId and sprint status info.
 */
export async function seedGoalWithTodos({
  todoCount,
  sprintStatus = 'planned',
  goalName = 'G',
}: {
  todoCount: number;
  sprintStatus?: 'planned' | 'active' | 'completed';
  goalName?: string;
}): Promise<SprintGoal & { sprintId: string }> {
  const sprint = await seedSprint({ status: sprintStatus, withGoals: [goalName] });
  const goal = sprint.goals[0];
  if (!goal) throw new Error('Goal not created in seedGoalWithTodos');

  for (let i = 0; i < todoCount; i++) {
    await seedTodo({
      sprintId: sprint.id,
      sprintGoalId: goal.id,
    });
  }

  return { ...goal, sprintId: sprint.id };
}

/**
 * Return ISO string N days from now.
 */
export function addDaysISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

/**
 * Return ISO string N hours from now.
 */
export function addHoursISO(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d.toISOString();
}

/**
 * Return ISO string N days in the past.
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ============================================================================
// Comment fixtures
// ============================================================================

/**
 * Create a Comment row.
 * Requires: todoId, authorUserId, body.
 */
export async function seedComment(overrides: {
  todoId: string;
  authorUserId: string;
  body: string;
  createdAt?: Date;
  editedAt?: Date | null;
}): Promise<Comment> {
  const db = getDb();
  const raw = await db.comment.create({
    data: {
      todoId: overrides.todoId,
      authorUserId: overrides.authorUserId,
      body: overrides.body,
      createdAt: overrides.createdAt ?? new Date(),
      editedAt: overrides.editedAt ?? null,
    },
  });
  return {
    id: raw.id,
    todoId: raw.todoId,
    authorUserId: raw.authorUserId,
    body: raw.body,
    createdAt: raw.createdAt,
    editedAt: raw.editedAt,
  };
}

// ============================================================================
// Activity event fixtures
// ============================================================================

/**
 * Create an ActivityEvent row directly (bypasses server actions).
 * Timestamps should be spaced by +1ms if a test asserts strict ordering.
 */
export async function seedActivity(overrides: {
  actorUserId: string;
  kind?: ActivityEventKind;
  targetTodoId?: string | null;
  targetSprintId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt?: Date;
}): Promise<ActivityEvent> {
  const db = getDb();
  const payloadJson = overrides.payload != null
    ? (overrides.payload as Prisma.InputJsonValue)
    : Prisma.JsonNull;
  const raw = await db.activityEvent.create({
    data: {
      actorUserId: overrides.actorUserId,
      kind: overrides.kind ?? 'todo_created',
      targetTodoId: overrides.targetTodoId ?? null,
      targetSprintId: overrides.targetSprintId ?? null,
      payloadJson,
      createdAt: overrides.createdAt ?? new Date(),
    },
  });
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
// Internal helpers
// ============================================================================

type PrismaRawUser = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapUser(raw: PrismaRawUser): User {
  return {
    id: raw.id,
    email: raw.email ?? '',
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl,
    role: raw.role as 'admin' | 'member',
    isActive: raw.isActive,
    lastSeenAt: raw.lastSeenAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
