'use client';
/**
 * CommentList — renders comments for a todo, oldest first (FR-18).
 * Author-only actions: edit / delete via DropdownMenu.
 * Shows "edited" marker if editedAt is set (FR-19).
 */
import { useState } from 'react';
import type { Comment, User } from '@/types/domain';
import { editComment, deleteComment } from '@/server/actions/comments';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';

interface CommentListProps {
  comments: Comment[];
  actor: User;
  /** Called after a successful edit or delete so the parent can refresh. */
  onMutated?: () => void;
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface CommentItemProps {
  comment: Comment;
  actor: User;
  onMutated: (() => void) | undefined;
}

function CommentItem({ comment, actor, onMutated }: CommentItemProps) {
  const isAuthor = comment.authorUserId === actor.id;
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEdit() {
    setSaving(true);
    setError(null);
    const res = await editComment({ id: comment.id, body: editBody }, { actor });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      onMutated?.();
    } else {
      setError(res.error.message);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this comment?')) return;
    const res = await deleteComment({ id: comment.id }, { actor });
    if (res.ok) {
      onMutated?.();
    }
  }

  return (
    <div className="flex gap-3 py-3 border-b last:border-b-0">
      {/* Avatar placeholder */}
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
        {actor.displayName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{comment.authorUserId === actor.id ? actor.displayName : 'Team member'}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
          {comment.editedAt && (
            <span className="text-xs text-muted-foreground italic">(edited)</span>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              maxLength={2000}
              rows={3}
              className="text-sm"
              disabled={saving}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleEdit} disabled={saving || editBody.trim().length === 0}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditBody(comment.body); }}>
                Cancel
              </Button>
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
        )}
      </div>

      {isAuthor && !editing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <span className="sr-only">Comment actions</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function CommentList({ comments, actor, onMutated }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No comments yet. Be the first to comment.</p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          actor={actor}
          onMutated={onMutated}
        />
      ))}
    </div>
  );
}
