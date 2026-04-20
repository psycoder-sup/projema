export function isNavLinkActive(pathname: string, href: string, exact = false): boolean {
  if (pathname === href) return true;
  if (exact) return false;
  return pathname.startsWith(`${href}/`);
}

/**
 * Picks the single best (longest) matching href from a list of nav candidates.
 * Resolves ambiguities between an "exact" item and its nested siblings — e.g.
 * on `/todos/<id>` we want "Backlog" (`/todos`) active, but on `/todos/mine`
 * we want "My todos" (`/todos/mine`) to win over "Backlog". Returns null when
 * nothing matches.
 */
export function bestNavMatch(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (best === null || href.length > best.length) best = href;
    }
  }
  return best;
}
