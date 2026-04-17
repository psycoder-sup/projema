/**
 * Todo detail page (full-page view, especially for mobile).
 * Shows title, status/priority, description, links, markdown document.
 * Comments are a Phase 4 placeholder.
 */
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getTodoDetail } from '@/server/actions/todos';
import { TodoDetailPanel } from '@/components/todos/TodoDetailPanel';

interface TodoDetailPageProps {
  params: { todoId: string };
}

export default async function TodoDetailPage({ params }: TodoDetailPageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect('/sign-in');

  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!dbUser) redirect('/sign-in');

  const actor = {
    id: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.displayName,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role as 'admin' | 'member',
    isActive: dbUser.isActive,
    lastSeenAt: dbUser.lastSeenAt,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
  };

  const result = await getTodoDetail({ id: params.todoId }, { actor });

  if (!result.ok) {
    if (result.error.code === 'not_found') notFound();
    redirect('/todos');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <TodoDetailPanel todo={result.data} actor={actor} />
    </div>
  );
}
