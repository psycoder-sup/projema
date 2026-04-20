import { cache } from 'react';
import { prisma } from '@/server/db/client';
import type { User } from '@/types/domain';

export const loadDbUser = cache(async (userId: string): Promise<User | null> => {
  const row = await prisma.user.findUnique({ where: { id: userId } });
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
