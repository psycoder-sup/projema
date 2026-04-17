import { TodoStatusChip } from './TodoStatusChip';
import { TodoPriorityChip } from './TodoPriorityChip';
import { MarkdownDoc } from './MarkdownDoc';
import { CommentList } from '@/components/comments/CommentList';
import { CommentComposer } from '@/components/comments/CommentComposer';
import type { Todo, Comment, User } from '@/types/domain';

interface TodoDetailPanelProps {
  todo: Todo;
  comments?: Comment[];
  actor: User;
}

export function TodoDetailPanel({ todo, comments = [], actor }: TodoDetailPanelProps) {
  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">{todo.title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <TodoStatusChip status={todo.status} />
          <TodoPriorityChip priority={todo.priority} />
          {todo.dueDate && (
            <span className="text-sm text-muted-foreground">Due {todo.dueDate}</span>
          )}
        </div>
      </div>

      {/* Description */}
      {todo.description && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-1">Description</h2>
          <p className="text-sm">{todo.description}</p>
        </div>
      )}

      {/* Links */}
      {todo.links.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Links</h2>
          <ul className="space-y-1">
            {todo.links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {link.label ?? link.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Markdown document */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Document</h2>
        <MarkdownDoc
          todoId={todo.id}
          document={todo.document}
          actor={actor}
        />
      </div>

      {/* Comments */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Comments {comments.length > 0 && `(${comments.length})`}
        </h2>
        <CommentList comments={comments} actor={actor} />
        <div className="mt-4">
          <CommentComposer todoId={todo.id} actor={actor} />
        </div>
      </div>
    </div>
  );
}
