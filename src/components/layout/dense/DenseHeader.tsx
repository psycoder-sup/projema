'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import type { User } from '@/types/domain';
import { DenseIcon } from './IconSprite';
import { DenseBellMenu } from './DenseBellMenu';

interface DenseHeaderProps {
  orgName: string;
  actor: User;
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

// Matches: cuid / cuid2 (`c` + 24+ alphanumerics), uuid v4, or numeric-only ids.
// Deliberately excludes a generic long-alphanumeric branch because it would
// swallow human slugs like `retrospective-playbook-2026-q2`.
const DYNAMIC_ID_RE = /^(c[a-z0-9]{24,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

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

export function DenseHeader({ orgName, actor }: DenseHeaderProps) {
  const pathname = usePathname() ?? '/dashboard';
  const router = useRouter();
  const crumbs = deriveCrumbs(pathname);

  // Global "C" shortcut: go to new-todo form. Ignored when the user is
  // typing in an input/textarea/contenteditable OR when focus is inside
  // (or a) Radix menu/dialog/listbox — standard Linear behaviour.
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return target.isContentEditable;
    }
    function isInOverlay(target: EventTarget | null): boolean {
      if (target instanceof HTMLElement) {
        if (
          target.closest(
            '[role="menu"],[role="menuitem"],[role="dialog"],[role="alertdialog"],[role="listbox"],[role="combobox"]',
          )
        ) {
          return true;
        }
      }
      return (
        document.querySelector(
          '[data-state="open"][role="menu"],' +
            '[data-state="open"][role="dialog"],' +
            '[data-state="open"][role="alertdialog"],' +
            '[data-state="open"][role="listbox"]',
        ) !== null
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'c' && e.key !== 'C') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (isInOverlay(e.target)) return;
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
          <span key={i} className="crumb-seg">
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
      <DenseBellMenu actor={actor} />
      <Link href="/todos/new" className="new-todo">
        <DenseIcon id="i-plus" />
        <span>New todo</span>
        <span className="kbd" aria-hidden>C</span>
      </Link>
    </header>
  );
}
