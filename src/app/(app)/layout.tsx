import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { loadDbUser } from '@/server/loaders/session-user';
import { loadSidebarData } from '@/server/loaders/sidebar';
import { PostHogPageView } from '@/components/layout/PostHogPageView';
import { DenseSidebar } from '@/components/layout/dense/DenseSidebar';
import { DenseHeader } from '@/components/layout/dense/DenseHeader';
import { IconSprite } from '@/components/layout/dense/IconSprite';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const userId = session.user.id;

  const [dbUser, sidebar] = await Promise.all([
    loadDbUser(userId),
    loadSidebarData(userId),
  ]);

  if (!dbUser) {
    redirect('/sign-in');
  }

  const orgName = 'parallax.co';
  const orgInitial = orgName.charAt(0).toUpperCase();

  return (
    <div className="dense-app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <IconSprite />
      <div className="shell">
        <DenseSidebar
          user={{
            id: dbUser.id,
            displayName: dbUser.displayName,
            email: dbUser.email,
            role: dbUser.role,
          }}
          orgName={orgName}
          orgInitial={orgInitial}
          sidebarSprints={sidebar.sprints}
          counts={sidebar.counts}
        />
        <div className="main">
          <DenseHeader orgName={orgName} actor={dbUser} />
          <PostHogPageView />
          <main id="main-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
