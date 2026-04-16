// Domain types — canonical type definitions for the entire application.
// See SPEC §7 for full documentation.

export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SprintStatus = 'planned' | 'active' | 'completed';

export interface SprintGoal {
  id: string;
  sprintId: string;
  name: string;
  position: number;
  createdAt: Date;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string; // ISO date (yyyy-mm-dd)
  endDate: string;
  status: SprintStatus;
  createdByUserId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  goals: SprintGoal[];
}

export type TodoStatus = 'todo' | 'in_progress' | 'done';
export type TodoPriority = 'low' | 'medium' | 'high';

export interface TodoLink {
  id: string;
  todoId: string;
  url: string;
  label: string | null;
  position: number;
}

export interface TodoDocument {
  todoId: string;
  contentMarkdown: string;
  updatedAt: Date;
  updatedByUserId: string;
}

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  assigneeUserId: string | null;
  dueDate: string | null; // ISO date
  sprintId: string | null;
  sprintGoalId: string | null;
  createdByUserId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  links: TodoLink[];
  document: TodoDocument | null;
}

export interface Comment {
  id: string;
  todoId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
}

export type ActivityEventKind =
  | 'todo_created'
  | 'todo_status_changed'
  | 'todo_assigned'
  | 'comment_posted'
  | 'sprint_created'
  | 'sprint_activated'
  | 'sprint_completed';

export interface ActivityEvent {
  id: string;
  actorUserId: string;
  kind: ActivityEventKind;
  targetTodoId: string | null;
  targetSprintId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export type NotificationKind = 'assigned' | 'due_soon' | 'comment_on_assigned';

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  targetTodoId: string;
  triggeredByUserId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface AllowlistEntry {
  id: string;
  email: string;
  addedByUserId: string;
  addedAt: Date;
}

export interface DashboardData {
  activeSprint:
    | null
    | {
        sprint: Sprint;
        goalProgress: Array<{
          goalId: string | null;
          name: string;
          done: number;
          total: number;
        }>;
        overall: { done: number; total: number };
      };
  myTodos: Todo[];
  upcomingDeadlines: Todo[];
  activity: ActivityEvent[];
}

// Discriminated result used by every server action
export type Result<T, E = ServerActionError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Discriminated union on `code` so conflict variants can carry extra fields
export type ServerActionError =
  | { code: 'active_sprint_conflict'; message: string; currentActiveSprintId: string }
  | { code: 'validation_failed'; message: string; field?: string }
  | {
      code:
        | 'unauthorized'
        | 'forbidden'
        | 'not_found'
        | 'conflict'
        | 'rate_limited'
        | 'document_too_large'
        | 'cannot_delete_sprint'
        | 'cannot_delete_last_admin'
        | 'internal_error';
      message: string;
    };

// UI-state discriminated union for the todo form
export type TodoFormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string; fieldErrors?: Record<string, string> }
  | { kind: 'success'; todoId: string };

// UI-state for the bell menu
export type NotificationsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: Notification[]; unreadCount: number };
