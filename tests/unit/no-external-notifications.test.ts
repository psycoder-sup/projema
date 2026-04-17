/**
 * Unit test: assert that src/ contains no imports of external notification services.
 * FR-27 compliance — all notifications are in-app only.
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FORBIDDEN_PATTERNS = [
  { label: 'nodemailer', pattern: /\bnodemailer\b/ },
  { label: '@sendgrid/mail', pattern: /\bsendgrid\b/ },
  { label: 'twilio', pattern: /\btwilio\b/ },
  { label: 'firebase-messaging', pattern: /\bfirebase-messaging\b/ },
  { label: 'firebase/messaging', pattern: /firebase\/messaging/ },
  { label: '@firebase/messaging', pattern: /@firebase\/messaging/ },
  { label: 'sgMail', pattern: /\bsgMail\b/ },
];

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('FR-27: no external notification service imports', () => {
  test('no forbidden notification package imports found in src/', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const allFiles = walkDir(srcDir);
    const violations: string[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`[${label}] found in ${path.relative(srcDir, file)}`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Forbidden external notification imports detected:\n${violations.join('\n')}`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
