// Longest-prefix match so `/todos/mine` picks `/todos/mine` over `/todos`,
// while `/todos/<id>` still falls back to `/todos`. Returns null on no match.
export function bestNavMatch(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (best === null || href.length > best.length) best = href;
    }
  }
  return best;
}
