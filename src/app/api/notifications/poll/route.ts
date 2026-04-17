import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { mapNotificationRow } from '@/server/db/notification-mappers';

/**
 * Notifications poll endpoint — FR-26.
 * Authenticated. Returns last 20 notifications + unreadCount for the current user.
 * Polled every 30s by the BellMenu client component.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const actorId = session.user.id;

  try {
    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: actorId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.notification.count({
        where: { userId: actorId, readAt: null },
      }),
    ]);

    return NextResponse.json({
      items: rows.map(mapNotificationRow),
      unreadCount,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
