/**
 * Unit test: pino logger exports from src/server/logger.ts
 */
import { describe, expect, it, beforeAll } from 'vitest';
import type { Logger } from 'pino';

describe('logger', () => {
  let logger: Logger;

  beforeAll(async () => {
    const mod = await import('../../src/server/logger');
    logger = mod.logger;
  });

  it('exports a pino logger object', () => {
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('has an info method that is callable', () => {
    expect(typeof logger.info).toBe('function');
    // Should not throw
    expect(() => logger.info('test message')).not.toThrow();
  });

  it('has warn, error, and debug methods', () => {
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });
});
