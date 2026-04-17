'use client';
/**
 * CommentComposer — textarea + Post button for submitting comments.
 * Shows a toast on rate_limited error: "You're doing that too fast".
 * Preserves form state on error.
 */
import { useState } from 'react';
import type { User } from '@/types/domain';
import { postComment } from '@/server/actions/comments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const MAX_BODY = 2000;

interface CommentComposerProps {
  todoId: string;
  actor: User;
  /** Called after a successful post so the parent can refresh. */
  onPosted?: () => void;
}

export function CommentComposer({ todoId, actor, onPosted }: CommentComposerProps) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    const res = await postComment({ todoId, body: body.trim() }, { actor });
    setSubmitting(false);

    if (res.ok) {
      setBody('');
      onPosted?.();
    } else {
      if (res.error.code === 'rate_limited') {
        // Show rate-limited feedback; preserve body so user can retry
        setError("You're doing that too fast — try again in a moment.");
      } else {
        setError(res.error.message);
      }
    }
  }

  const remaining = MAX_BODY - body.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_BODY}
        rows={3}
        className="text-sm resize-none"
        disabled={submitting}
        aria-label="Comment body"
      />
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${remaining < 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {remaining} chars remaining
        </span>
        <div className="flex items-center gap-2">
          {error && (
            <span role="alert" className="text-xs text-destructive">{error}</span>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={submitting || body.trim().length === 0}
          >
            {submitting ? 'Posting...' : 'Post'}
          </Button>
        </div>
      </div>
    </form>
  );
}
