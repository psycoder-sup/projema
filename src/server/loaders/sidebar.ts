import { unstable_cache } from 'next/cache';
import { prisma } from '@/server/db/client';

export interface SidebarSprint {
  id: string;
  name: string;
  status: 'planned' | 'active' | 'completed';
}

export interface SidebarData {
  sprints: SidebarSprint[];
  counts: {
    myTodos: number;
    backlog: number;
    activeSprints: number;
  };
}

async function fetchSidebarData(userId: string): Promise<SidebarData> {
  const [sprints, myTodos, backlog, activeSprints] = await Promise.all([
    prisma.sprint.findMany({
      where: { status: { in: ['active', 'planned'] } },
      select: { id: true, name: true, status: true },
      orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
      take: 5,
    }),
    prisma.todo.count({
      where: { assigneeUserId: userId, status: { not: 'done' } },
    }),
    prisma.todo.count({
      where: { sprintId: null, status: { not: 'done' } },
    }),
    prisma.sprint.count({ where: { status: 'active' } }),
  ]);

  return {
    sprints: sprints.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status as SidebarSprint['status'],
    })),
    counts: { myTodos, backlog, activeSprints },
  };
}

export function loadSidebarData(userId: string): Promise<SidebarData> {
  return unstable_cache(() => fetchSidebarData(userId), ['sidebar-data', userId], {
    revalidate: 60,
    tags: [`sidebar:${userId}`, 'sidebar'],
  })();
}
