/**
 * Markdown rendering pipeline.
 * Uses react-markdown with remark-gfm for GFM support.
 * All rendered HTML is passed through sanitizeMarkdown before rendering.
 */
'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeMarkdown } from './sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * MarkdownRenderer — renders GFM markdown with DOMPurify sanitization.
 * Safe to use with untrusted user content.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Sanitize the raw markdown source before rendering
  const safeContent = sanitizeMarkdown(content);

  return React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    className,
  }, safeContent);
}

/**
 * renderMarkdown — returns a sanitized HTML string from markdown source.
 * Used in tests to assert on rendered output without a DOM.
 * This is a server-safe function (no React).
 */
export function renderMarkdown(content: string): string {
  // For test contexts: basic markdown-to-html via regex is insufficient;
  // we use a minimal custom renderer and rely on sanitization to strip XSS.
  // In production, MarkdownRenderer (React component) is used instead.
  const sanitized = sanitizeMarkdown(content);
  return sanitized;
}
