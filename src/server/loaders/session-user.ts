import { cache } from 'react';
import { prisma } from '@/server/db/client';
import type { User } from '@/types/domain';

export const loadDbUser = cache(async (userId: string): Promise<User | null> => {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role as User['role'],
    isActive: row.isActive,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
});
