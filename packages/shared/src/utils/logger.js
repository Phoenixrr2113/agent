import fs from 'fs';
import path from 'path';
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const LOG_COLORS = {
    debug: '\x1b[36m',
    info: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
};
const RESET_COLOR = '\x1b[0m';
function getEnvLogLevel() {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    if (envLevel && envLevel in LOG_LEVELS) {
        return envLevel;
    }
    return 'info';
}
export function createLogger(options = {}) {
    let currentLevel = options.level || getEnvLogLevel();
    const enableColors = options.enableColors ?? true;
    const enableTimestamps = options.enableTimestamps ?? true;
    const logToConsole = options.logToConsole ?? true;
    const logFile = options.logFile || process.env.LOG_FILE;
    let fileStream = null;
    if (logFile) {
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        fileStream = fs.createWriteStream(logFile, { flags: 'a' });
    }
    function shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
    }
    function formatMessage(level, message, meta, useColors = enableColors) {
        const parts = [];
        if (enableTimestamps) {
            const timestamp = new Date().toISOString();
            parts.push(`[${timestamp}]`);
        }
        const levelStr = level.toUpperCase().padEnd(5);
        if (useColors) {
            parts.push(`${LOG_COLORS[level]}${levelStr}${RESET_COLOR}`);
        }
        else {
            parts.push(levelStr);
        }
        parts.push(message);
        if (meta && Object.keys(meta).length > 0) {
            parts.push(JSON.stringify(meta));
        }
        return parts.join(' ');
    }
    function log(level, message, meta) {
        if (!shouldLog(level)) {
            return;
        }
        if (logToConsole) {
            const formatted = formatMessage(level, message, meta, true);
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
        if (fileStream) {
            const formatted = formatMessage(level, message, meta, false);
            fileStream.write(formatted + '\n');
        }
    }
    return {
        debug(message, meta) {
            log('debug', message, meta);
        },
        info(message, meta) {
            log('info', message, meta);
        },
        warn(message, meta) {
            log('warn', message, meta);
        },
        error(message, meta) {
            log('error', message, meta);
        },
        setLevel(level) {
            currentLevel = level;
        },
        close() {
            if (fileStream) {
                fileStream.end();
                fileStream = null;
            }
        },
    };
}
export const logger = createLogger();
