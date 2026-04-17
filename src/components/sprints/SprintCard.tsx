'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  planned: 'secondary',
  active: 'default',
  completed: 'outline',
};

const statusLabel: Record<string, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
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

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex-1 min-w-0 mr-2">
            <CardTitle className="text-base font-semibold truncate">
              <a
                href={`/sprints/${sprint.id}`}
                className="hover:underline"
              >
                {sprint.name}
              </a>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {sprint.startDate} – {sprint.endDate}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={statusBadgeVariant[sprint.status] ?? 'secondary'}>
              {statusLabel[sprint.status] ?? sprint.status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <span className="sr-only">Sprint actions</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
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
                      className="text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {sprint.goals.length} {sprint.goals.length === 1 ? 'goal' : 'goals'}
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
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
            <Button onClick={handleActivate} disabled={loading}>
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
