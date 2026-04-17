'use client';

import { useState, useTransition } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/lib/markdown/render';
import { saveTodoDocument } from '@/server/actions/todos';
import type { TodoDocument } from '@/types/domain';
import type { User } from '@/types/domain';

interface MarkdownDocProps {
  todoId: string;
  document: TodoDocument | null;
  actor: User;
  onSave?: (doc: TodoDocument) => void;
}

export function MarkdownDoc({ todoId, document, actor, onSave }: MarkdownDocProps) {
  const [content, setContent] = useState(document?.contentMarkdown ?? '');
  const [savedContent, setSavedContent] = useState(document?.contentMarkdown ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = content !== savedContent;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveTodoDocument(
        {
          todoId,
          contentMarkdown: content,
          expectedUpdatedAt: document?.updatedAt?.toISOString(),
        },
        { actor },
      );
      if (res.ok) {
        setSavedContent(content);
        onSave?.(res.data.doc);
        if (res.data.stale) {
          setError('This document was updated by someone else — your changes were saved (last write wins).');
        }
      } else {
        setError(res.error.message);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Tabs defaultValue="view">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="view">View</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>
          {isDirty && (
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>

        <TabsContent value="view">
          {savedContent ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <MarkdownRenderer content={savedContent} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No document yet. Click Edit to add one.</p>
          )}
        </TabsContent>

        <TabsContent value="edit">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="Write in Markdown (GFM supported)…"
            className="font-mono text-sm"
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
