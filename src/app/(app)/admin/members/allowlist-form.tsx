'use client';
/**
 * Client component for allowlist add/remove forms on the Admin Members page.
 */
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddAllowlistFormProps {
  addEmail: (email: string) => Promise<{ ok: boolean; error?: { message: string } }>;
}

export function AddAllowlistForm({ addEmail }: AddAllowlistFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await addEmail(email.trim());
      if (result.ok) {
        setSuccess(`${email.trim()} added to allowlist.`);
        setEmail('');
      } else {
        setError(result.error?.message ?? 'Failed to add email.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <Input
        type="email"
        placeholder="user@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1"
        aria-label="Email to allowlist"
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Adding...' : 'Add'}
      </Button>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      {success && <p className="text-sm text-green-600 mt-1">{success}</p>}
    </form>
  );
}

interface RemoveAllowlistButtonProps {
  entryId: string;
  email: string;
  removeEntry: (entryId: string) => Promise<{ ok: boolean; error?: { message: string } }>;
}

export function RemoveAllowlistButton({ entryId, email, removeEntry }: RemoveAllowlistButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Remove ${email} from allowlist?`)) return;
    startTransition(async () => {
      await removeEntry(entryId);
    });
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? 'Removing...' : 'Remove'}
    </Button>
  );
}

interface DeactivateUserButtonProps {
  userId: string;
  displayName: string;
  deactivate: (userId: string) => Promise<{ ok: boolean; error?: { message: string } }>;
}

export function DeactivateUserButton({ userId, displayName, deactivate }: DeactivateUserButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm(`Deactivate ${displayName}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deactivate(userId);
      if (!result.ok) {
        setError(result.error?.message ?? 'Failed to deactivate.');
      }
    });
  }

  return (
    <div>
      <Button variant="destructive" size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Deactivating...' : 'Deactivate'}
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
