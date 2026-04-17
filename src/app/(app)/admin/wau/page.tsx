/**
 * Admin WAU (Weekly Active Users) page — FR-28.
 * Server component. Admin-gated; non-admin → 403.
 */
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { adminGetWau } from '@/server/actions/admin';
import type { User } from '@/types/domain';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function AdminWauPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser || dbUser.role !== 'admin') {
    notFound();
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

  const result = await adminGetWau({}, { actor });
  if (!result.ok) {
    notFound();
  }

  const { totalMembers, wauCount, wauWindow } = result.data;
  const pct = totalMembers > 0 ? Math.round((wauCount / totalMembers) * 100) : 0;

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4">
      <h1 className="text-2xl font-bold mb-2">Weekly Active Users</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Rolling 7-day window: {formatDate(wauWindow.start)} &rarr; {formatDate(wauWindow.end)}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-6 text-center">
          <div className="text-4xl font-bold">{wauCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Active this week</div>
        </div>
        <div className="rounded-lg border p-6 text-center">
          <div className="text-4xl font-bold">{totalMembers}</div>
          <div className="mt-1 text-sm text-muted-foreground">Total members</div>
        </div>
        <div className="rounded-lg border p-6 text-center">
          <div className="text-4xl font-bold">{pct}%</div>
          <div className="mt-1 text-sm text-muted-foreground">Engagement rate</div>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {wauCount} of {totalMembers} members were active in the past 7 days ({pct}%).
        {pct >= 80
          ? ' Target met (≥ 80%).'
          : ` Target is ≥ 80% — currently ${80 - pct} percentage point(s) below target.`}
      </p>
    </div>
  );
}
