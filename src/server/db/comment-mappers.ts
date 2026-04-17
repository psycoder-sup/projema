/**
 * Mapper functions to convert Prisma Comment rows to domain Comment types.
 */
import type { Comment } from '@/types/domain';

type PrismaCommentRow = {
  id: string;
  todoId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
};

export function mapCommentRow(raw: PrismaCommentRow): Comment {
  return {
    id: raw.id,
    todoId: raw.todoId,
    authorUserId: raw.authorUserId,
    body: raw.body,
    createdAt: raw.createdAt,
    editedAt: raw.editedAt,
  };
}
