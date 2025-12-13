import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function findRepositoryRoot(startDirectory?: string): string {
  let currentDirectory = startDirectory ?? process.cwd();
  while (currentDirectory !== path.dirname(currentDirectory)) {
    if (fs.existsSync(path.join(currentDirectory, 'pnpm-workspace.yaml'))) {
      return currentDirectory;
    }
    if (fs.existsSync(path.join(currentDirectory, 'package.json'))) {
      try {
        const fileContent = fs.readFileSync(path.join(currentDirectory, 'package.json'), 'utf-8');
        const packageJson = JSON.parse(fileContent) as { workspaces?: unknown };
        if (packageJson.workspaces) {
          return currentDirectory;
        }
      } catch {
        // Ignore invalid package.json
      }
    }
    currentDirectory = path.dirname(currentDirectory);
  }
  return process.cwd();
}

function resolveLogFilePath(logFilePath: string): string {
  if (path.isAbsolute(logFilePath)) {
    return logFilePath;
  }
  const repoRoot = findRepositoryRoot();
  return path.resolve(repoRoot, logFilePath);
}

export interface LoggerOptions {
  level?: LogLevel;
  enableColors?: boolean;
  enableTimestamps?: boolean;
  logFile?: string;
  logToConsole?: boolean;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
  reconfigure(options?: LoggerOptions): void;
  close(): void;
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
  const envLevel = process.env['LOG_LEVEL']?.toLowerCase();
  
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return 'info';
}

// eslint-disable-next-line max-lines-per-function
export function createLogger(options: LoggerOptions = {}): Logger {
  let currentLevel: LogLevel = options.level ?? getEnvLogLevel();
  const enableColors = options.enableColors ?? true;
  const enableTimestamps = options.enableTimestamps ?? true;
  const logToConsole = options.logToConsole ?? true;
  const logFile = options.logFile ?? process.env['LOG_FILE'];

  let fileStream: fs.WriteStream | null = null;

  if (logFile) {
    const resolvedLogFile = resolveLogFilePath(logFile);
    const logDirectory = path.dirname(resolvedLogFile);
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }
    fileStream = fs.createWriteStream(resolvedLogFile, { flags: 'a' });
  }

  function shouldLog(level: LogLevel): boolean {
    // eslint-disable-next-line security/detect-object-injection
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
  }

  function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>, useColors: boolean = enableColors): string {
    const parts: string[] = [];

    if (enableTimestamps) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }

    const levelString = level.toUpperCase().padEnd(5);
    if (useColors) {
      // eslint-disable-next-line security/detect-object-injection
      parts.push(`${LOG_COLORS[level]}${levelString}${RESET_COLOR}`);
    } else {
      parts.push(levelString);
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

    if (logToConsole) {
      const formatted = formatMessage(level, message, meta, true);
      /* eslint-disable no-console */
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
      /* eslint-enable no-console */
    }

    if (fileStream) {
      const formatted = formatMessage(level, message, meta, false);
      fileStream.write(formatted + '\n');
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

    reconfigure(newOptions: LoggerOptions = {}): void {
      currentLevel = newOptions.level ?? getEnvLogLevel();

      const newLogFile = newOptions.logFile ?? process.env['LOG_FILE'];

      if (fileStream) {
        fileStream.end();
        fileStream = null;
      }

      if (newLogFile) {
        const resolvedLogFile = resolveLogFilePath(newLogFile);
        const logDirectory = path.dirname(resolvedLogFile);
        if (!fs.existsSync(logDirectory)) {
          fs.mkdirSync(logDirectory, { recursive: true });
        }
        fileStream = fs.createWriteStream(resolvedLogFile, { flags: 'a' });
      }
    },

    close(): void {
      if (fileStream) {
        fileStream.end();
        fileStream = null;
      }
    },
  };
}

export const logger = createLogger();
