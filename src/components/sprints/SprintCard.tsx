'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Sprint, User } from '@/types/domain';
import { activateSprint, deleteSprint, completeSprint } from '@/server/actions/sprints';

interface SprintCardProps {
  sprint: Sprint;
  actor: User;
  onMutate?: () => void;
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'acid'> = {
  planned: 'secondary',
  active: 'acid',
  completed: 'default',
};

const statusLabel: Record<string, string> = {
  planned: 'Planned',
  active: '● Live',
  completed: 'Done',
};

export function SprintCard({ sprint, actor, onMutate }: SprintCardProps) {
  const router = useRouter();
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    setLoading(true);
    setError(null);
    const result = await activateSprint({ id: sprint.id }, { actor });
    setLoading(false);
    if (result.ok) {
      setConfirmActivate(false);
      onMutate?.();
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }

  async function handleComplete() {
    setLoading(true);
    setError(null);
    const result = await completeSprint({ id: sprint.id }, { actor });
    setLoading(false);
    if (result.ok) {
      setConfirmComplete(false);
      onMutate?.();
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await deleteSprint({ id: sprint.id }, { actor });
    setLoading(false);
    if (result.ok) {
      setConfirmDelete(false);
      onMutate?.();
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }

  const idShort = sprint.id.slice(0, 6).toUpperCase();

  return (
    <>
      <Card className="group flex flex-col transition-[transform,box-shadow] duration-100 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-brut">
        <CardHeader className="space-y-0 pb-3">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              SPR-{idShort}
            </span>
            <Badge variant={statusBadgeVariant[sprint.status] ?? 'secondary'} className="shrink-0">
              {statusLabel[sprint.status] ?? sprint.status}
            </Badge>
          </div>
          <a
            href={`/sprints/${sprint.id}`}
            className="mt-2 block truncate font-display text-xl uppercase leading-tight tracking-tight hover:text-ink group-hover:underline decoration-acid decoration-4 underline-offset-4"
          >
            {sprint.name}
          </a>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
          <div className="border-y-2 border-ink/80 py-2 font-mono text-[11px] uppercase tracking-wider text-ink">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Start</span>
              <span className="tabular-nums">{sprint.startDate}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">End</span>
              <span className="tabular-nums">{sprint.endDate}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Goals · <span className="font-bold text-ink">{sprint.goals.length}</span>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <span className="sr-only">Sprint actions</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={`/sprints/${sprint.id}`}>View detail</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/sprints/${sprint.id}/edit`}>Edit</a>
                </DropdownMenuItem>
                {sprint.status === 'planned' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmActivate(true)}>
                      Make active
                    </DropdownMenuItem>
                  </>
                )}
                {sprint.status === 'active' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmComplete(true)}>
                      Complete sprint
                    </DropdownMenuItem>
                  </>
                )}
                {sprint.status === 'planned' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rust focus:bg-rust focus:text-white"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {error && (
            <p className="mt-1 border-2 border-ink bg-rust px-2 py-1 font-mono text-[10px] uppercase text-white">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Activate confirmation */}
      <Dialog open={confirmActivate} onOpenChange={setConfirmActivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make sprint active?</DialogTitle>
            <DialogDescription>
              This will make &quot;{sprint.name}&quot; the active sprint.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmActivate(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="acid" onClick={handleActivate} disabled={loading}>
              {loading ? 'Activating…' : 'Make active'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete confirmation */}
      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete sprint?</DialogTitle>
            <DialogDescription>
              This will mark &quot;{sprint.name}&quot; as completed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmComplete(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={loading}>
              {loading ? 'Completing…' : 'Complete sprint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete sprint?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{sprint.name}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
