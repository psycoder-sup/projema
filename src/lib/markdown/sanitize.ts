/**
 * Markdown sanitization using isomorphic-dompurify.
 * Strips script tags, javascript: URLs, and on* event handlers.
 * Preserves GFM output (tables, code blocks, etc.).
 */
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeMarkdown(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    ALLOW_DATA_ATTR: false,
  });
}
