/**
 * Date utility helpers.
 * See SPEC §7 for date/string mapping conventions.
 */

/**
 * Converts a Prisma Date object (from a DB `date` column) to an ISO date string.
 * Prisma returns date-typed columns as JS Date objects, but domain types use strings.
 * This mapper is applied at every action boundary (server → client).
 */
export function toIsoDate(d: Date | null): string | null {
  if (d === null) return null;
  // Format as YYYY-MM-DD, using UTC to avoid timezone drift on date-only values
  return d.toISOString().substring(0, 10);
}

/**
 * Returns true if two ISO date strings represent the same calendar day.
 */
export function isSameDay(a: string, b: string): boolean {
  return a.substring(0, 10) === b.substring(0, 10);
}
