'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavLinkActive } from '@/components/layout/nav-active';
import type { Sprint } from '@/types/domain';
import { DenseIcon } from './IconSprite';
import { DenseAvatar } from './DenseAvatar';

interface SidebarProps {
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    role: 'admin' | 'member';
  };
  orgName: string;
  orgInitial: string;
  sidebarSprints: Array<Pick<Sprint, 'id' | 'name' | 'status'>>;
  counts: {
    myTodos: number;
    backlog: number;
    activeSprints: number;
  };
}

interface NavSpec {
  id: string;
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
  count: number | null;
}

export function DenseSidebar({ user, orgName, orgInitial, sidebarSprints, counts }: SidebarProps) {
  const pathname = usePathname() ?? '';

  const items: NavSpec[] = [
    { id: 'dash', label: 'Dashboard', href: '/dashboard', icon: 'i-dash', exact: true, count: null },
    { id: 'mine', label: 'My todos', href: '/todos/mine', icon: 'i-check-sq', count: counts.myTodos },
    { id: 'sprints', label: 'Sprints', href: '/sprints', icon: 'i-sprint', count: counts.activeSprints },
    { id: 'back', label: 'Backlog', href: '/todos', icon: 'i-inbox', exact: true, count: counts.backlog },
  ];
  if (user.role === 'admin') {
    items.push({ id: 'team', label: 'Team', href: '/admin/members', icon: 'i-team', count: null });
  }

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <Link href="/dashboard" className="logo" aria-label="Projema home">
        <div className="logo-mark" aria-hidden />
        <div className="logo-name">Projema</div>
      </Link>

      <button type="button" className="org-switcher" aria-label="Switch organisation">
        <div className="org-avatar" aria-hidden>
          {orgInitial}
        </div>
        <div className="org-name">{orgName}</div>
        <DenseIcon id="i-chev" size={12} className="chev" />
      </button>

      <nav className="nav-section" aria-label="Main">
        {items.map((it) => {
          const active = isNavLinkActive(pathname, it.href, it.exact ?? false);
          return (
            <Link
              key={it.id}
              href={it.href}
              className={`nav-item ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <DenseIcon id={it.icon} />
              <span>{it.label}</span>
              {it.count != null && it.count > 0 && (
                <span className="nav-count" aria-label={`${it.count} items`}>
                  {it.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {sidebarSprints.length > 0 && (
        <div className="nav-section" aria-label="Sprints">
          <div className="nav-label">Sprints</div>
          {sidebarSprints.map((s) => {
            const sprintHref = `/sprints/${s.id}`;
            const active = pathname === sprintHref;
            const dotColor =
              s.status === 'active'
                ? 'var(--accent)'
                : s.status === 'planned'
                  ? 'var(--info)'
                  : 'var(--fg-4)';
            return (
              <Link
                key={s.id}
                href={sprintHref}
                className={`nav-item ${s.status === 'active' || active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    marginLeft: 4,
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: s.status === 'active' ? 'var(--fg-0)' : 'var(--fg-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.name}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="sidebar-bottom">
        <div className="me-card">
          <DenseAvatar
            userId={user.id}
            displayName={user.displayName}
            email={user.email}
            size="md"
          />
          <div style={{ minWidth: 0 }}>
            <div className="me-name">{user.displayName ?? user.email ?? 'You'}</div>
            <div className="me-sub">
              {user.role} · {orgName}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
