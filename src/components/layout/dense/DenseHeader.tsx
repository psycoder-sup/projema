'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { DenseIcon } from './IconSprite';
import { DenseBellMenu } from './DenseBellMenu';

interface DenseHeaderProps {
  orgName: string;
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

// Matches: cuid (c + 24 chars), cuid2, uuid, or numeric-only ids.
const DYNAMIC_ID_RE = /^(c[a-z0-9]{24,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[a-z0-9]{24,})$/i;

function looksLikeId(seg: string): boolean {
  return DYNAMIC_ID_RE.test(seg);
}

function deriveCrumbs(pathname: string): string[] {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return ['Dashboard'];

  const out: string[] = [];
  for (const s of segs) {
    const mapped = CRUMB_LABELS[s];
    if (mapped) {
      out.push(mapped);
      continue;
    }
    // Detail page under a known collection: `/sprints/<id>`, `/todos/<id>`, `/admin/members/<id>`.
    if (looksLikeId(s)) {
      out.push('Details');
      continue;
    }
    // Humanise unknown slug segments.
    out.push(s.charAt(0).toUpperCase() + s.slice(1));
  }
  return out;
}

export function DenseHeader({ orgName }: DenseHeaderProps) {
  const pathname = usePathname() ?? '/dashboard';
  const router = useRouter();
  const crumbs = deriveCrumbs(pathname);

  // Global "C" shortcut: go to new-todo form. Ignored when the user is
  // typing in an input/textarea/contenteditable — standard Linear behaviour.
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return target.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'c' && e.key !== 'C') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      router.push('/todos/new');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <header className="dense-header" role="banner">
      <nav className="crumbs" aria-label="Breadcrumb">
        <span>{orgName}</span>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="sep">/</span>
            <span
              className={i === crumbs.length - 1 ? 'here' : undefined}
              aria-current={i === crumbs.length - 1 ? 'page' : undefined}
            >
              {c}
            </span>
          </span>
        ))}
      </nav>
      <div className="h-spacer" />
      <DenseBellMenu />
      <Link href="/todos/new" className="new-todo">
        <DenseIcon id="i-plus" />
        <span>New todo</span>
        <span className="kbd" aria-hidden>C</span>
      </Link>
    </header>
  );
}
