/**
 * @agent/sdk - Minimal Logger
 * Zero-dependency logger that works in Node, Bun, and browser environments
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  enableColors?: boolean;
  enableTimestamps?: boolean;
  prefix?: string;
}

export interface AgentContext {
  type: 'main' | 'spawned';
  taskId?: string;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  meta: Record<string, unknown> | undefined;
  formattedMessage: string;
}

export type LogSubscriber = (entry: LogEntry) => void;

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
  setAgentContext(context: AgentContext): void;
  subscribe(callback: LogSubscriber): () => void;
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

// Runtime detection for browser vs Node/Bun
const isBrowser = typeof globalThis !== 'undefined' 
  && typeof (globalThis as typeof globalThis & { document?: unknown }).document !== 'undefined';

function getEnvLogLevel(): LogLevel {
  if (isBrowser) return 'info';
  
  const envLevel = (typeof process !== 'undefined' ? process.env?.['LOG_LEVEL'] : undefined)?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return 'info';
}

export function createLogger(options: LoggerOptions = {}): Logger {
  let currentLevel: LogLevel = options.level ?? getEnvLogLevel();
  const enableColors = options.enableColors ?? !isBrowser;
  const enableTimestamps = options.enableTimestamps ?? true;
  const prefix = options.prefix;

  let agentContext: AgentContext | undefined;
  const subscribers = new Set<LogSubscriber>();

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
  }

  function formatMessage(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
    useColors: boolean = enableColors
  ): string {
    const parts: string[] = [];

    if (enableTimestamps) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }

    const levelString = level.toUpperCase().padEnd(5);
    if (useColors && !isBrowser) {
      parts.push(`${LOG_COLORS[level]}${levelString}${RESET_COLOR}`);
    } else {
      parts.push(levelString);
    }

    if (prefix) {
      parts.push(`[${prefix}]`);
    }

    if (agentContext) {
      if (agentContext.type === 'main') {
        const ctxLabel = useColors && !isBrowser ? '\x1b[1m[MAIN]\x1b[0m' : '[MAIN]';
        parts.push(ctxLabel);
      } else if (agentContext.type === 'spawned') {
        const taskLabel = agentContext.taskId ? agentContext.taskId.slice(-8) : 'sub';
        const ctxLabel = useColors && !isBrowser 
          ? `\x1b[90m[SUB:${taskLabel}]\x1b[0m` 
          : `[SUB:${taskLabel}]`;
        parts.push(ctxLabel);
      }
    }

    parts.push(message);

    if (meta && Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta));
    }

    return parts.join(' ');
  }

  function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(level)) {
      return;
    }

    const formatted = formatMessage(level, message, meta);
    
    if (isBrowser) {
      // Browser-compatible logging with colors via console API
      const style = level === 'error' ? 'color: red' 
                  : level === 'warn' ? 'color: orange'
                  : level === 'debug' ? 'color: cyan'
                  : 'color: green';
      console[level === 'debug' ? 'log' : level](`%c${formatted}`, style);
    } else {
      // Node/Bun logging
      switch (level) {
        case 'error':
          console.error(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'info':
        case 'debug':
          console.log(formatted);
          break;
      }
    }

    if (subscribers.size > 0) {
      const entry: LogEntry = {
        timestamp: Date.now(),
        level,
        message,
        meta,
        formattedMessage: formatMessage(level, message, meta, false),
      };
      for (const callback of Array.from(subscribers)) {
        try {
          callback(entry);
        } catch {
          // Ignore subscriber errors
        }
      }
    }
  }

  return {
    debug(message: string, meta?: Record<string, unknown>): void {
      log('debug', message, meta);
    },

    info(message: string, meta?: Record<string, unknown>): void {
      log('info', message, meta);
    },

    warn(message: string, meta?: Record<string, unknown>): void {
      log('warn', message, meta);
    },

    error(message: string, meta?: Record<string, unknown>): void {
      log('error', message, meta);
    },

    setLevel(level: LogLevel): void {
      currentLevel = level;
    },

    setAgentContext(context: AgentContext): void {
      agentContext = context;
    },

    subscribe(callback: LogSubscriber): () => void {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}

export const logger = createLogger();
