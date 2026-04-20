/**
 * Tiny shared helpers for the dense dashboard:
 *   - color/initials derivation for avatars (no avatar URLs in the design)
 *   - goal accent palette
 */

const AVATAR_PALETTE_BUCKETS = 5;

export function avatarBucket(seed: string | null | undefined): number {
  const s = seed ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % AVATAR_PALETTE_BUCKETS) + 1;
}

export function initialsFor(displayName: string | null | undefined, email: string | null | undefined): string {
  const source = (displayName ?? email ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

const GOAL_PALETTE: string[] = [
  'oklch(74% 0.16 145)', // signal green
  'oklch(72% 0.17 25)', // red-orange
  'oklch(72% 0.16 300)', // violet
  'oklch(78% 0.12 240)', // info blue
  'oklch(80% 0.15 75)', // amber
  'oklch(78% 0.12 200)', // cyan
];

export function goalColor(index: number): string {
  return GOAL_PALETTE[index % GOAL_PALETTE.length] ?? 'oklch(74% 0.16 145)';
}

export function diffDays(target: Date, today: Date): number {
  const t = new Date(target);
  const n = new Date(today);
  t.setHours(0, 0, 0, 0);
  n.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - n.getTime()) / 86_400_000);
}

export function dueLabel(diff: number | null): { text: string; cls: '' | 'soon' | 'overdue' } {
  if (diff === null) return { text: '—', cls: '' };
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'overdue' };
  if (diff === 0) return { text: 'today', cls: 'soon' };
  if (diff === 1) return { text: 'tomorrow', cls: 'soon' };
  if (diff <= 2) return { text: `in ${diff}d`, cls: 'soon' };
  return { text: `in ${diff}d`, cls: '' };
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortMonth(monthIdx: number): string {
  return SHORT_MONTHS[monthIdx] ?? '';
}

/**
 * Returns "today" as a YYYY-MM-DD string in the given IANA time zone. Use
 * this when comparing against calendar-day-valued columns (Sprint.startDate
 * / endDate) so 02:00 Tokyo and 22:00 LA resolve to the correct wall-clock
 * calendar day, not whatever UTC happens to be.
 */
export function todayIsoInZone(now: Date, timeZone: string): string {
  // en-CA always formats as YYYY-MM-DD.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

/**
 * Day-count math for sprint timelines. All three arguments must be calendar
 * days expressed as YYYY-MM-DD strings — typically sprint.startDate,
 * sprint.endDate, and `todayIsoInZone(now, env.ORG_TIMEZONE)`.
 * Returns inclusive `totalDays` plus `todayIndex` (1-based; 0 = before sprint,
 * totalDays + 1 = after).
 */
export function sprintDayMath(
  startIso: string,
  endIso: string,
  todayIso: string,
): { totalDays: number; todayIndex: number } {
  const dayMs = 86_400_000;
  const startMs = Date.parse(startIso + 'T00:00:00Z');
  const endMs = Date.parse(endIso + 'T00:00:00Z');
  const todayMs = Date.parse(todayIso + 'T00:00:00Z');
  const totalDays = Math.max(1, Math.round((endMs - startMs) / dayMs) + 1);
  const diff = Math.round((todayMs - startMs) / dayMs); // 0-based
  const todayIndex = diff < 0 ? 0 : diff >= totalDays ? totalDays + 1 : diff + 1;
  return { totalDays, todayIndex };
}
