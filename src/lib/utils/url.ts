/**
 * URL utility helpers.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/**
 * Validates that a URL uses an allowed scheme (http, https, or mailto).
 * Prevents javascript: / data: injection in todo links.
 * See SPEC §2 todo_links.
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}
