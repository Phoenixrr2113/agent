/**
 * @agent/sdk - Logger Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, logger } from '../utils/logger';
import type { Logger, LogLevel, LogSubscriber, LogEntry } from '../utils/logger';

describe('createLogger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic logging', () => {
    it('should create a logger with default options', () => {
      const log = createLogger();
      expect(log).toBeDefined();
      expect(log.debug).toBeInstanceOf(Function);
      expect(log.info).toBeInstanceOf(Function);
      expect(log.warn).toBeInstanceOf(Function);
      expect(log.error).toBeInstanceOf(Function);
    });

    it('should log info messages', () => {
      const log = createLogger({ level: 'info' });
      log.info('test message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      const log = createLogger({ level: 'warn' });
      log.warn('warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const log = createLogger({ level: 'error' });
      log.error('error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should not log debug when level is info', () => {
      const log = createLogger({ level: 'info' });
      log.debug('debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should respect log level hierarchy', () => {
      const log = createLogger({ level: 'warn' });
      
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');

      // Only warn and error should be logged
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('should allow changing log level', () => {
      const log = createLogger({ level: 'error' });
      
      log.info('should not log');
      expect(consoleSpy.log).not.toHaveBeenCalled();

      log.setLevel('debug');
      log.info('should log now');
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('metadata', () => {
    it('should include metadata in log output', () => {
      const log = createLogger({ level: 'info' });
      log.info('message with meta', { key: 'value' });
      
      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('"key":"value"');
    });
  });

  describe('agent context', () => {
    it('should include main agent context', () => {
      const log = createLogger({ level: 'info' });
      log.setAgentContext({ type: 'main' });
      log.info('main agent message');
      
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[MAIN]');
    });

    it('should include spawned agent context', () => {
      const log = createLogger({ level: 'info' });
      log.setAgentContext({ type: 'spawned', taskId: 'task-12345678' });
      log.info('sub agent message');
      
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[SUB:');
    });
  });

  describe('subscribers', () => {
    it('should notify subscribers on log', () => {
      const log = createLogger({ level: 'info' });
      const subscriber = vi.fn<[LogEntry], void>();
      
      log.subscribe(subscriber);
      log.info('test message');
      
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber.mock.calls[0][0]).toMatchObject({
        level: 'info',
        message: 'test message',
      });
    });

    it('should allow unsubscribing', () => {
      const log = createLogger({ level: 'info' });
      const subscriber = vi.fn<[LogEntry], void>();
      
      const unsubscribe = log.subscribe(subscriber);
      log.info('first');
      expect(subscriber).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      log.info('second');
      expect(subscriber).toHaveBeenCalledTimes(1);
    });
  });

  describe('timestamps', () => {
    it('should include timestamps by default', () => {
      const log = createLogger({ level: 'info', enableTimestamps: true });
      log.info('timestamped');
      
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should omit timestamps when disabled', () => {
      const log = createLogger({ level: 'info', enableTimestamps: false });
      log.info('no timestamp');
      
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });
  });
});

describe('default logger', () => {
  it('should export a default logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeInstanceOf(Function);
  });
});
