/**
 * Admin Members page — FR-03.
 * Requires admin role. Shows members list and allowlist management.
 */
import { prisma } from '@/server/db/client';
import { auth } from '@/server/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { addAllowlistEmail, removeAllowlistEmail, deactivateUser } from '@/server/actions/admin';
import { AddAllowlistForm, RemoveAllowlistButton, DeactivateUserButton } from './allowlist-form';
import type { User } from '@/types/domain';

export default async function AdminMembersPage() {
  const session = await auth();

  if (!session?.user) {
    return <div className="p-6 text-destructive">Unauthorized</div>;
  }

  const userId = session.user.id;
  if (!userId) {
    return <div className="p-6 text-destructive">Unauthorized</div>;
  }
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!dbUser || dbUser.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-destructive font-semibold">403 Forbidden</p>
        <p className="text-muted-foreground mt-1">You do not have permission to view this page.</p>
      </div>
    );
  }

  const actor: User = {
    id: dbUser.id,
    email: dbUser.email ?? '',
    displayName: dbUser.displayName,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role as 'admin' | 'member',
    isActive: dbUser.isActive,
    lastSeenAt: dbUser.lastSeenAt,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  };

  const [members, allowlist] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.allowlistEntry.findMany({
      orderBy: { addedAt: 'desc' },
    }),
  ]);

  // Server action wrappers bound to this actor
  async function handleAddEmail(email: string) {
    'use server';
    const result = await addAllowlistEmail({ email }, { actor });
    if (!result.ok) return { ok: false, error: { message: result.error.message } };
    return { ok: true };
  }

  async function handleRemoveEntry(entryId: string) {
    'use server';
    const result = await removeAllowlistEmail({ entryId }, { actor });
    if (!result.ok) return { ok: false, error: { message: result.error.message } };
    return { ok: true };
  }

  async function handleDeactivate(userId: string) {
    'use server';
    const result = await deactivateUser({ userId }, { actor });
    if (!result.ok) return { ok: false, error: { message: result.error.message } };
    return { ok: true };
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Members</h1>

      {/* Allowlist management */}
      <Card>
        <CardHeader>
          <CardTitle>Allowlist</CardTitle>
          <CardDescription>
            Emails on this list can sign in as members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddAllowlistForm addEmail={handleAddEmail} />
          {allowlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails in allowlist.</p>
          ) : (
            <div className="divide-y">
              {allowlist.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{entry.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {entry.addedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <RemoveAllowlistButton
                    entryId={entry.id}
                    email={entry.email}
                    removeEntry={handleRemoveEntry}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current members */}
      <Card>
        <CardHeader>
          <CardTitle>Current Members</CardTitle>
          <CardDescription>Active workspace members.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active members.</p>
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{member.displayName}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                  {member.id !== actor.id && (
                    <DeactivateUserButton
                      userId={member.id}
                      displayName={member.displayName}
                      deactivate={handleDeactivate}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
