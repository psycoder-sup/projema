/**
 * Sprints list page — FR-21.
 * Server component; fetches listSprints and groups by status.
 */
import Link from 'next/link';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { listSprints } from '@/server/actions/sprints';
import { SprintCard } from '@/components/sprints/SprintCard';
import { Button } from '@/components/ui/button';
import type { User } from '@/types/domain';

interface SectionProps {
  index: string;
  label: string;
  count: number;
  accent: 'acid' | 'muted' | 'ink';
  children: React.ReactNode;
}

function SprintSection({ index, label, count, accent, children }: SectionProps) {
  const accentClass =
    accent === 'acid'
      ? 'bg-acid border-ink'
      : accent === 'ink'
        ? 'bg-ink border-ink'
        : 'bg-paper border-ink';
  return (
    <section>
      <div className="mb-5 flex items-center gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center border-2 ${accentClass} font-display text-lg uppercase`}
          aria-hidden
        >
          {index}
        </span>
        <div className="flex flex-1 items-baseline gap-3 border-b-2 border-ink pb-2">
          <h2 className="font-display text-2xl uppercase tracking-tight">{label}</h2>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            / {String(count).padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

export default async function SprintsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-6 text-destructive">Unauthorized</div>;
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) {
    return <div className="p-6 text-destructive">User not found</div>;
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

  const result = await listSprints({}, { actor });
  const sprints = result.ok ? result.data : [];

  const active = sprints.filter((s) => s.status === 'active');
  const planned = sprints.filter((s) => s.status === 'planned');
  const completed = sprints.filter((s) => s.status === 'completed');

  return (
    <div className="px-4 py-8 lg:px-10 lg:py-12 space-y-12">
      {/* Masthead */}
      <header className="border-b-2 border-ink pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker mb-3">
              <span className="mr-2 inline-block border-2 border-ink bg-acid px-1.5 py-[2px] text-ink">
                VOL.02
              </span>
              Sprint register
            </p>
            <h1 className="display-xl">Sprints</h1>
          </div>
          <Button asChild variant="acid" size="lg">
            <Link href="/sprints/new">+ New sprint</Link>
          </Button>
        </div>
      </header>

      {!result.ok && (
        <div className="border-2 border-ink bg-rust px-4 py-3 font-mono text-xs uppercase tracking-wider text-white">
          FAIL · {result.error.message}
        </div>
      )}

      {active.length > 0 && (
        <SprintSection index="01" label="Active" count={active.length} accent="acid">
          {active.map((sprint) => (
            <SprintCard key={sprint.id} sprint={sprint} actor={actor} />
          ))}
        </SprintSection>
      )}

      {planned.length > 0 && (
        <SprintSection index="02" label="Planned" count={planned.length} accent="muted">
          {planned.map((sprint) => (
            <SprintCard key={sprint.id} sprint={sprint} actor={actor} />
          ))}
        </SprintSection>
      )}

      {completed.length > 0 && (
        <SprintSection index="03" label="Completed" count={completed.length} accent="ink">
          {completed.map((sprint) => (
            <SprintCard key={sprint.id} sprint={sprint} actor={actor} />
          ))}
        </SprintSection>
      )}

      {sprints.length === 0 && result.ok && (
        <div className="border-2 border-ink bg-paper p-10 text-center shadow-brut">
          <p className="font-display text-3xl uppercase">No sprints yet.</p>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Plan your first sprint to start shipping.
          </p>
          <div className="mt-5">
            <Button asChild variant="acid">
              <Link href="/sprints/new">+ New sprint</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
