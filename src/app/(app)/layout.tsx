/**
 * Authenticated app shell layout — FR-04.
 * Redirects to /sign-in if no session.
 * Renders Topbar with user menu + sign-out on every authenticated route.
 */
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/server/auth';
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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const user = session.user;
  const initials = (user.name ?? user.email ?? 'U').charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-semibold text-sm">Sprint Todo Management</span>
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
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
