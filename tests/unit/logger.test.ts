/**
 * Unit test: pino logger exports from src/server/logger.ts
 */
import { describe, expect, it, vi } from 'vitest';

describe('logger', () => {
  it('exports a pino logger object', async () => {
    const mod = await import('../../src/server/logger');
    const { logger } = mod;
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('has an info method that is callable', async () => {
    const mod = await import('../../src/server/logger');
    const { logger } = mod;
    expect(typeof logger.info).toBe('function');
    // Should not throw
    expect(() => logger.info('test message')).not.toThrow();
  });

  it('has warn, error, and debug methods', async () => {
    const mod = await import('../../src/server/logger');
    const { logger } = mod;
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });
});
