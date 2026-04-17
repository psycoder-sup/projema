/**
 * Authenticated app shell layout — FR-04.
 * Redirects to /sign-in if no session.
 * Renders Topbar with nav links, BellMenu (Phase 6), user menu + sign-out on every authenticated route.
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
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { BellMenu } from '@/components/layout/BellMenu';
import { PostHogPageView } from '@/components/layout/PostHogPageView';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const user = session.user;
  const initials = (user.name ?? user.email ?? 'U').charAt(0).toUpperCase();

  // Check if the user is admin (for the Members nav link)
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
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          {/* App name / logo */}
          <Link
            href="/dashboard"
            className="font-semibold text-sm shrink-0 hover:opacity-80 transition-opacity"
          >
            Sprint Todo
          </Link>

          {/* Navigation links */}
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto" aria-label="Main navigation">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sprints">Sprints</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/todos">Todos</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/todos/mine">My Todos</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/members">Members</Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/wau">WAU</Link>
              </Button>
            )}
          </nav>

          {/* Right side: bell + user menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* BellMenu — Phase 6: polls /api/notifications/poll every 30s */}
            <BellMenu />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                  <Avatar
                    src={user.image ?? null}
                    alt={user.name ?? user.email ?? 'User'}
                    fallback={initials}
                    size="sm"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    {user.name && (
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                    )}
                    {user.email && (
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
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
      <main className="flex-1">{children}</main>
    </div>
  );
}
