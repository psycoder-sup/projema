const AVATAR_PALETTE_BUCKETS = 5;

export function avatarBucket(seed: string | null | undefined): number {
  const s = seed ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % AVATAR_PALETTE_BUCKETS) + 1;
}

export function initialsFor(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
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
  'oklch(74% 0.16 145)',
  'oklch(72% 0.17 25)',
  'oklch(72% 0.16 300)',
  'oklch(78% 0.12 240)',
  'oklch(80% 0.15 75)',
  'oklch(78% 0.12 200)',
];

export function goalColor(index: number): string {
  return GOAL_PALETTE[index % GOAL_PALETTE.length] ?? 'oklch(74% 0.16 145)';
}

// Parse a YYYY-MM-DD calendar day as UTC midnight so comparisons are
// independent of the render process's local timezone.
export function parseIsoDate(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}

export function diffDaysIso(targetIso: string, todayIso: string): number {
  const dayMs = 86_400_000;
  return Math.round(
    (parseIsoDate(targetIso).getTime() - parseIsoDate(todayIso).getTime()) / dayMs,
  );
}

export function dueLabel(
  diff: number | null,
): { text: string; cls: '' | 'soon' | 'overdue' } {
  if (diff === null) return { text: '—', cls: '' };
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'overdue' };
  if (diff === 0) return { text: 'today', cls: 'soon' };
  if (diff === 1) return { text: 'tomorrow', cls: 'soon' };
  if (diff <= 2) return { text: `in ${diff}d`, cls: 'soon' };
  return { text: `in ${diff}d`, cls: '' };
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export function shortMonth(monthIdx: number): string {
  return SHORT_MONTHS[monthIdx] ?? '';
}

export function shortId(id: string): string {
  return id.slice(0, 6);
}

// `long: true` → "just now"/"m ago"/…; default → "now"/"m"/….
export function formatTimeAgo(date: Date, opts: { long?: boolean } = {}): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  const long = opts.long ?? false;
  if (diff < 60) return long ? 'just now' : 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}${long ? 'm ago' : 'm'}`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}${long ? 'h ago' : 'h'}`;
  return `${Math.floor(diff / 86_400)}${long ? 'd ago' : 'd'}`;
}

// Formats `now` as YYYY-MM-DD in the given IANA zone, so calendar-day
// comparisons against Sprint.startDate/endDate resolve to the org's
// wall-clock day regardless of the server's UTC offset.
export function todayIsoInZone(now: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

// Inclusive `totalDays` + 1-based `todayIndex` (0 before start,
// totalDays+1 after end). All three args are YYYY-MM-DD calendar days.
export function sprintDayMath(
  startIso: string,
  endIso: string,
  todayIso: string,
): { totalDays: number; todayIndex: number } {
  const dayMs = 86_400_000;
  const startMs = parseIsoDate(startIso).getTime();
  const endMs = parseIsoDate(endIso).getTime();
  const todayMs = parseIsoDate(todayIso).getTime();
  const totalDays = Math.max(1, Math.round((endMs - startMs) / dayMs) + 1);
  const diff = Math.round((todayMs - startMs) / dayMs);
  const todayIndex = diff < 0 ? 0 : diff >= totalDays ? totalDays + 1 : diff + 1;
  return { totalDays, todayIndex };
}

export function greetingFor(date: Date, timeZone: string): string {
  const hour = Number(
    date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone }),
  );
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatLocalStamp(date: Date, timeZone: string): string {
  const dayPart = date.toLocaleString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  });
  const timePart = date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
  return `${dayPart} · ${timePart} local`;
}
