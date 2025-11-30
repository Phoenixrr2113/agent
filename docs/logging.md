# Logging Configuration

The agent supports flexible logging to both console and file.

## Features

- **Multiple log levels**: `debug`, `info`, `warn`, `error`
- **Console logging**: Colored output with timestamps
- **File logging**: Plain text logs without color codes
- **Dual output**: Log to both console and file simultaneously
- **Environment variable configuration**: Set via `.env` file

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Set log level (debug, info, warn, error)
LOG_LEVEL=info

# Enable file logging
LOG_FILE=logs/agent.log
```

### Programmatic Configuration

```typescript
import { createLogger } from './core/logger.js';

const logger = createLogger({
  level: 'debug',
  enableColors: true,
  enableTimestamps: true,
  logFile: 'logs/agent.log',
  logToConsole: true,
});

logger.info('Application started');
logger.debug('Debug information', { userId: 123 });
logger.warn('Warning message');
logger.error('Error occurred', { error: 'details' });

// Close file stream when done
logger.close();
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'` or `LOG_LEVEL` env var | Minimum log level to output |
| `enableColors` | `boolean` | `true` | Enable colored console output |
| `enableTimestamps` | `boolean` | `true` | Include timestamps in logs |
| `logFile` | `string` | `undefined` or `LOG_FILE` env var | Path to log file (creates directory if needed) |
| `logToConsole` | `boolean` | `true` | Enable console output |

## Usage Examples

### Console Only (Default)
```typescript
import { logger } from './core/logger.js';

logger.info('This goes to console only');
```

### File Only
```typescript
import { createLogger } from './core/logger.js';

const fileLogger = createLogger({
  logFile: 'logs/app.log',
  logToConsole: false,
});

fileLogger.info('This goes to file only');
```

### Both Console and File
```typescript
import { createLogger } from './core/logger.js';

const logger = createLogger({
  logFile: 'logs/app.log',
  logToConsole: true,
});

logger.info('This goes to both console and file');
```

### Using Environment Variables

**.env:**
```bash
LOG_LEVEL=debug
LOG_FILE=logs/agent-$(date +%Y%m%d).log
```

**Code:**
```typescript
import { logger } from './core/logger.js';

// Automatically uses LOG_LEVEL and LOG_FILE from .env
logger.debug('Debug message');
logger.info('Info message');
```

## Log Format

### Console Output (with colors)
```
[2025-11-29T13:54:30.583Z] INFO  🚀 Creating agent runtime
[2025-11-29T13:54:30.584Z] DEBUG Processing new messages {"totalMessages":2}
[2025-11-29T13:54:30.585Z] WARN  ⚠️ No tool calls made
[2025-11-29T13:54:30.586Z] ERROR Failed to connect {"error":"Connection refused"}
```

### File Output (no colors)
```
[2025-11-29T13:54:30.583Z] INFO  🚀 Creating agent runtime
[2025-11-29T13:54:30.584Z] DEBUG Processing new messages {"totalMessages":2}
[2025-11-29T13:54:30.585Z] WARN  ⚠️ No tool calls made
[2025-11-29T13:54:30.586Z] ERROR Failed to connect {"error":"Connection refused"}
```

## Log Rotation

The logger doesn't include built-in log rotation. For production use, consider:

1. **Using date-based filenames:**
   ```bash
   LOG_FILE=logs/agent-$(date +%Y%m%d).log
   ```

2. **External log rotation tools:**
   - Linux: `logrotate`
   - macOS: `newsyslog`
   - Node.js: `rotating-file-stream` package

3. **Custom rotation script:**
   ```bash
   # Rotate logs daily
   0 0 * * * mv logs/agent.log logs/agent-$(date +%Y%m%d).log
   ```

## Testing

Run chat mode with file logging:

```bash
# Set in .env
LOG_FILE=logs/chat-session.log

# Run chat
pnpm chat

# View logs in real-time
tail -f logs/chat-session.log
```

## Best Practices

1. **Use appropriate log levels:**
   - `debug`: Detailed diagnostic information
   - `info`: General informational messages
   - `warn`: Warning messages for potentially harmful situations
   - `error`: Error events that might still allow the application to continue

2. **Include context in metadata:**
   ```typescript
   logger.info('User action', { userId, action: 'login', timestamp: Date.now() });
   ```

3. **Close logger on shutdown:**
   ```typescript
   process.on('SIGINT', () => {
     logger.info('Shutting down...');
     logger.close();
     process.exit(0);
   });
   ```

4. **Use separate log files for different purposes:**
   ```typescript
   const errorLogger = createLogger({ 
     logFile: 'logs/errors.log',
     level: 'error',
     logToConsole: false,
   });
   ```

