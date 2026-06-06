import type { LogLevel, Logger } from '../types/index.js';

/**
 * Centralized logger utility.
 * Wraps console with log levels for consistent output.
 * Designed to be swapped with Winston/Pino later without changing call sites.
 */

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const shouldLog = (level: LogLevel): boolean => LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];

const formatMessage = (level: LogLevel, message: string, meta?: Record<string, unknown>): string => {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
};

const logger: Logger = {
  error: (message: string, meta?: Record<string, unknown>): void => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  },

  warn: (message: string, meta?: Record<string, unknown>): void => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  info: (message: string, meta?: Record<string, unknown>): void => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },

  debug: (message: string, meta?: Record<string, unknown>): void => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  },
};

export default logger;
