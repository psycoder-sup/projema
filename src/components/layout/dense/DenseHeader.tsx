'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { DenseIcon } from './IconSprite';

interface DenseHeaderProps {
  orgName: string;
  hasUnreadNotifications: boolean;
}

const CRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  sprints: 'Sprints',
  todos: 'Backlog',
  mine: 'Mine',
  admin: 'Admin',
  members: 'Members',
  wau: 'WAU',
  new: 'New',
};

function deriveCrumbs(pathname: string): string[] {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return ['Dashboard'];
  return segs.map((s) => CRUMB_LABELS[s] ?? s);
}

export function DenseHeader({ orgName, hasUnreadNotifications }: DenseHeaderProps) {
  const pathname = usePathname() ?? '/dashboard';
  const crumbs = deriveCrumbs(pathname);

  return (
    <header className="dense-header" role="banner">
      <nav className="crumbs" aria-label="Breadcrumb">
        <span>{orgName}</span>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="sep">/</span>
            <span className={i === crumbs.length - 1 ? 'here' : undefined}>{c}</span>
          </span>
        ))}
      </nav>
      <div className="h-spacer" />
      <button type="button" className="search" aria-label="Search">
        <DenseIcon id="i-search" size={13} />
        <span>Search todos, sprints, people…</span>
        <span className="kbd">⌘K</span>
      </button>
      <button type="button" className="h-btn" aria-label="Command menu">
        <DenseIcon id="i-cmd" />
      </button>
      <button type="button" className="h-btn" aria-label="Tweaks">
        <DenseIcon id="i-tune" />
      </button>
      <button type="button" className="h-btn" aria-label="Notifications">
        <DenseIcon id="i-bell" />
        {hasUnreadNotifications && <span className="bell-dot" aria-hidden />}
      </button>
      <Link href="/todos/new" className="new-todo">
        <DenseIcon id="i-plus" />
        <span>New todo</span>
        <span className="kbd">C</span>
      </Link>
    </header>
  );
}
