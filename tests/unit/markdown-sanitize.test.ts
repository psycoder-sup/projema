/**
 * Unit tests for markdown sanitization (FR-17).
 */
import { describe, test, expect } from 'vitest';
import { sanitizeMarkdown } from '@/lib/markdown/sanitize';

describe('FR-17: sanitizeMarkdown', () => {
  test('strips <script> tags', () => {
    const input = 'hello <script>alert(1)</script> world';
    const result = sanitizeMarkdown(input);
    expect(result).not.toMatch(/<script/i);
    expect(result).toContain('hello');
  });

  test('strips javascript: hrefs', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeMarkdown(input);
    expect(result).not.toContain('javascript:');
  });

  test('strips onerror handlers', () => {
    const input = '<img src=x onerror=alert(1)>';
    const result = sanitizeMarkdown(input);
    expect(result).not.toMatch(/onerror/i);
  });

  test('strips onload handlers', () => {
    const input = '<svg onload=alert(1)>';
    const result = sanitizeMarkdown(input);
    expect(result).not.toMatch(/onload/i);
  });

  test('strips iframes', () => {
    const input = '<iframe src="http://evil.example"></iframe>';
    const result = sanitizeMarkdown(input);
    expect(result).not.toMatch(/<iframe/i);
  });

  test('preserves safe HTML elements', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    const result = sanitizeMarkdown(input);
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  test('preserves plain text', () => {
    const input = 'Hello world, nothing special here.';
    const result = sanitizeMarkdown(input);
    expect(result).toContain('Hello world');
  });

  test.each([
    '<img src=x onerror=alert(1)>',
    '<iframe src="http://evil.example"></iframe>',
    '<svg onload=alert(1)>',
  ])('sanitizer strips XSS payload: %s', (payload) => {
    const html = sanitizeMarkdown(`before ${payload} after`);
    expect(html).not.toMatch(/onerror|onload|<iframe|<script/i);
  });
});
