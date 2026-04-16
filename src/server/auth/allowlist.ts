/**
 * Allowlist check logic.
 * Phase 1 implementation — Phase 0 stub only.
 */

/**
 * Checks whether an email is in the allowlist.
 * In Phase 0, always returns true (no allowlist enforcement yet).
 * Phase 1: query allowlist_entries + handle bootstrap case.
 */
export async function isEmailAllowlisted(_email: string): Promise<boolean> {
  // Phase 1: implement real allowlist check against DB
  return true;
}
