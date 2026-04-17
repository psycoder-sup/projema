import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { adminGetWau } from '@/server/actions/admin';
import type { User } from '@/types/domain';

/**
 * Admin WAU (Weekly Active Users) endpoint — FR-28.
 * Returns { totalMembers, wauCount, wauWindow: { start, end } }.
 * Admin-gated: 403 for non-admins.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const status = result.error.code === 'forbidden' ? 403 : 500;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json(result.data, { status: 200 });
}
