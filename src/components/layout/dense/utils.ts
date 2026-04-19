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
