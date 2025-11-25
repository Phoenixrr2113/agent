import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, type LogLevel } from './logger.js';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let originalEnv: string | undefined;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalEnv = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    if (originalEnv !== undefined) {
      process.env.LOG_LEVEL = originalEnv;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  describe('createLogger', () => {
    it('should create a logger with default options', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.setLevel).toBeDefined();
    });

    it('should create a logger with custom log level', () => {
      const logger = createLogger({ level: 'warn' });
      logger.info('test');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      logger.warn('test');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should create a logger with colors disabled', () => {
      const logger = createLogger({ enableColors: false });
      logger.info('test');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toContain('\x1b[');
    });

    it('should create a logger with timestamps disabled', () => {
      const logger = createLogger({ enableTimestamps: false });
      logger.info('test');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should respect LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'error';
      const logger = createLogger();
      logger.info('test');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      logger.error('test');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should default to info level if LOG_LEVEL is invalid', () => {
      process.env.LOG_LEVEL = 'invalid';
      const logger = createLogger();
      logger.info('test');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      const logger = createLogger({ level: 'debug' });
      logger.debug('debug message');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('DEBUG');
      expect(output).toContain('debug message');
    });

    it('should log info messages when level is info', () => {
      const logger = createLogger({ level: 'info' });
      logger.info('info message');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('INFO');
      expect(output).toContain('info message');
    });

    it('should log warn messages when level is warn', () => {
      const logger = createLogger({ level: 'warn' });
      logger.warn('warn message');
      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = consoleWarnSpy.mock.calls[0][0];
      expect(output).toContain('WARN');
      expect(output).toContain('warn message');
    });

    it('should log error messages when level is error', () => {
      const logger = createLogger({ level: 'error' });
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('ERROR');
      expect(output).toContain('error message');
    });
  });

  describe('log level filtering', () => {
    it('should not log debug when level is info', () => {
      const logger = createLogger({ level: 'info' });
      logger.debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log info when level is warn', () => {
      const logger = createLogger({ level: 'warn' });
      logger.info('info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log warn when level is error', () => {
      const logger = createLogger({ level: 'error' });
      logger.warn('warn message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log all levels when level is debug', () => {
      const logger = createLogger({ level: 'debug' });
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatting', () => {
    it('should include timestamps when enabled', () => {
      const logger = createLogger({ enableTimestamps: true });
      logger.info('test');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    it('should not include timestamps when disabled', () => {
      const logger = createLogger({ enableTimestamps: false });
      logger.info('test');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should include color codes when enabled', () => {
      const logger = createLogger({ enableColors: true });
      logger.info('test');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('\x1b[32m');
      expect(output).toContain('\x1b[0m');
    });

    it('should not include color codes when disabled', () => {
      const logger = createLogger({ enableColors: false });
      logger.info('test');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toContain('\x1b[');
    });

    it('should pad log level to 5 characters', () => {
      const logger = createLogger({ enableColors: false, enableTimestamps: false });
      logger.info('test');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/INFO {1}/);
    });

    it('should use correct color for each log level', () => {
      const logger = createLogger({ enableColors: true, level: 'debug' });

      logger.debug('test');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('\x1b[36m');

      logger.info('test');
      expect(consoleLogSpy.mock.calls[1][0]).toContain('\x1b[32m');

      logger.warn('test');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('\x1b[33m');

      logger.error('test');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('\x1b[31m');
    });
  });

  describe('metadata', () => {
    it('should include metadata as JSON when provided', () => {
      const logger = createLogger({ enableTimestamps: false, enableColors: false });
      logger.info('test message', { foo: 'bar', count: 42 });
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('test message');
      expect(output).toContain('{"foo":"bar","count":42}');
    });

    it('should not include metadata section when no metadata provided', () => {
      const logger = createLogger({ enableTimestamps: false, enableColors: false });
      logger.info('test message');
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toBe('INFO  test message');
    });

    it('should handle empty metadata object', () => {
      const logger = createLogger({ enableTimestamps: false, enableColors: false });
      logger.info('test message', {});
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toContain('{}');
      expect(output).toBe('INFO  test message');
    });

    it('should handle complex metadata structures', () => {
      const logger = createLogger({ enableTimestamps: false, enableColors: false });
      const metadata = {
        nested: { value: 123 },
        array: [1, 2, 3],
        bool: true,
      };
      logger.info('test', metadata);
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain(JSON.stringify(metadata));
    });
  });

  describe('setLevel', () => {
    it('should allow changing log level dynamically', () => {
      const logger = createLogger({ level: 'error' });
      logger.info('test');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      logger.setLevel('info');
      logger.info('test');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should immediately affect filtering', () => {
      const logger = createLogger({ level: 'debug' });
      logger.debug('debug 1');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      logger.setLevel('warn');
      logger.debug('debug 2');
      logger.info('info 2');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      logger.warn('warn 2');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('console method routing', () => {
    it('should route debug and info to console.log', () => {
      const logger = createLogger({ level: 'debug' });
      logger.debug('debug');
      logger.info('info');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should route warn to console.warn', () => {
      const logger = createLogger({ level: 'warn' });
      logger.warn('warn');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should route error to console.error', () => {
      const logger = createLogger({ level: 'error' });
      logger.error('error');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('singleton logger export', () => {
    it('should export a default logger instance', async () => {
      const { logger } = await import('./logger.js');
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
    });
  });
});
