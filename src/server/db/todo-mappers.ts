/**
 * Mapper functions to convert Prisma Todo rows to domain Todo types.
 * Uses toIsoDate for date-typed columns.
 */
import { toIsoDate } from '@/lib/utils/date';
import type { Todo, TodoLink, TodoDocument, TodoStatus, TodoPriority } from '@/types/domain';

type PrismaTodoLinkRow = {
  id: string;
  todoId: string;
  url: string;
  label: string | null;
  position: number;
  createdAt: Date;
};

type PrismaTodoDocumentRow = {
  todoId: string;
  contentMarkdown: string;
  updatedAt: Date;
  updatedByUserId: string;
};

type PrismaTodoRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeUserId: string | null;
  dueDate: Date | null;
  sprintId: string | null;
  sprintGoalId: string | null;
  createdByUserId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  links?: PrismaTodoLinkRow[];
  document?: PrismaTodoDocumentRow | null;
};

export function mapTodoLinkRow(row: PrismaTodoLinkRow): TodoLink {
  return {
    id: row.id,
    todoId: row.todoId,
    url: row.url,
    label: row.label,
    position: row.position,
  };
}

export function mapTodoDocumentRow(row: PrismaTodoDocumentRow): TodoDocument {
  return {
    todoId: row.todoId,
    contentMarkdown: row.contentMarkdown,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

/**
 * Map a Prisma Todo row (with optional links and document) to the domain Todo type.
 */
export function mapTodoRow(
  row: PrismaTodoRow,
  links?: PrismaTodoLinkRow[],
  document?: PrismaTodoDocumentRow | null,
): Todo {
  const resolvedLinks = row.links ?? links ?? [];
  const resolvedDoc = row.document !== undefined ? row.document : document ?? null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TodoStatus,
    priority: row.priority as TodoPriority,
    assigneeUserId: row.assigneeUserId,
    dueDate: toIsoDate(row.dueDate),
    sprintId: row.sprintId,
    sprintGoalId: row.sprintGoalId,
    createdByUserId: row.createdByUserId,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    links: resolvedLinks.map(mapTodoLinkRow),
    document: resolvedDoc ? mapTodoDocumentRow(resolvedDoc) : null,
  };
}
