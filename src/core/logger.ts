export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  enableColors?: boolean;
  enableTimestamps?: boolean;
}

export interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  setLevel(level: LogLevel): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET_COLOR = '\x1b[0m';

function getEnvLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return 'info';
}

export function createLogger(options: LoggerOptions = {}): Logger {
  let currentLevel: LogLevel = options.level || getEnvLogLevel();
  const enableColors = options.enableColors ?? true;
  const enableTimestamps = options.enableTimestamps ?? true;

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
  }

  function formatMessage(level: LogLevel, message: string, meta?: Record<string, any>): string {
    const parts: string[] = [];

    if (enableTimestamps) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }

    const levelStr = level.toUpperCase().padEnd(5);
    if (enableColors) {
      parts.push(`${LOG_COLORS[level]}${levelStr}${RESET_COLOR}`);
    } else {
      parts.push(levelStr);
    }

    parts.push(message);

    if (meta && Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta));
    }

    return parts.join(' ');
  }

  function log(level: LogLevel, message: string, meta?: Record<string, any>): void {
    if (!shouldLog(level)) {
      return;
    }

    const formatted = formatMessage(level, message, meta);

    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  return {
    debug(message: string, meta?: Record<string, any>): void {
      log('debug', message, meta);
    },

    info(message: string, meta?: Record<string, any>): void {
      log('info', message, meta);
    },

    warn(message: string, meta?: Record<string, any>): void {
      log('warn', message, meta);
    },

    error(message: string, meta?: Record<string, any>): void {
      log('error', message, meta);
    },

    setLevel(level: LogLevel): void {
      currentLevel = level;
    },
  };
}

export const logger = createLogger();
