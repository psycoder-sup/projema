/**
 * Authenticated app shell layout — FR-04.
 * Redirects to /sign-in if no session.
 * Renders the brutalist Topbar: wordmark + nav + BellMenu + user menu on every authenticated route.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/server/auth';
import { prisma } from '@/server/db/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { BellMenu } from '@/components/layout/BellMenu';
import { NavLink } from '@/components/layout/NavLink';
import { PostHogPageView } from '@/components/layout/PostHogPageView';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const user = session.user;
  const initials = (user.name ?? user.email ?? 'U').charAt(0).toUpperCase();

  let isAdmin = false;
  if (user.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    isAdmin = dbUser?.role === 'admin';
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Skip link for keyboard users — WCAG 2.4.1 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-acid focus:text-ink focus:border-2 focus:border-ink focus:shadow-brut focus:outline-none"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 w-full border-b-2 border-ink bg-paper">
        <div className="flex h-16 items-stretch">
          {/* Wordmark block — acid square beside the name */}
          <Link
            href="/dashboard"
            className="group flex items-center gap-3 border-r-2 border-ink px-5 transition-colors hover:bg-acid"
          >
            <span
              aria-hidden
              className="h-5 w-5 border-2 border-ink bg-acid group-hover:bg-ink"
            />
            <span className="font-display text-lg uppercase leading-none tracking-tight">
              Projema
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:inline">
              /v.01
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="flex flex-1 items-stretch overflow-x-auto"
          >
            <NavLink href="/dashboard" label="Dashboard" exact />
            <NavLink href="/sprints" label="Sprints" />
            <NavLink href="/todos" label="Backlog" exact />
            <NavLink href="/todos/mine" label="Mine" />
            {isAdmin && <NavLink href="/admin/members" label="Members" />}
            {isAdmin && <NavLink href="/admin/wau" label="WAU" />}
          </nav>

          <div className="flex items-center gap-2 border-l-2 border-ink px-3">
            <BellMenu />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center border-2 border-ink bg-paper transition-[transform,background-color] hover:bg-acid active:translate-x-[1px] active:translate-y-[1px]"
                  aria-label="Account menu"
                >
                  <Avatar
                    src={user.image ?? null}
                    alt={user.name ?? user.email ?? 'User'}
                    fallback={initials}
                    size="sm"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    {user.name && (
                      <p className="font-sans text-sm font-semibold leading-none normal-case tracking-normal">
                        {user.name}
                      </p>
                    )}
                    {user.email && (
                      <p className="font-mono text-[10px] leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/sign-in' });
                  }}
                >
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full cursor-pointer">
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <PostHogPageView />
      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="mt-12 border-t-2 border-ink bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Projema / Sprint-Todo Control</span>
          <span aria-hidden>◼ ◻ ◼ ◻ ◼</span>
          <span>Made by the team — built to ship.</span>
        </div>
      </footer>
    </div>
  );
}
