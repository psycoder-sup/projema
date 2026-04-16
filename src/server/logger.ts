/**
 * Structured logger using pino.
 * Used throughout the server layer for request logging, action logging, and error reporting.
 */
import pino from 'pino';

const isDevelopment = process.env['NODE_ENV'] === 'development';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (isDevelopment ? 'debug' : 'info'), // Not in envSchema — logger must load before env validation runs to avoid circular init.
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
