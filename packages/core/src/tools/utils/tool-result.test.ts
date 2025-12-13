import { describe, it, expect } from 'vitest';

import { success, error, safeTool, safeToolSync, withTiming } from './tool-result.js';

describe('tool-result utilities', () => {
  describe('success', () => {
    it('should return stringified success result with data', () => {
      const result = success({ path: '/test/file.txt', content: 'hello' });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.path).toBe('/test/file.txt');
      expect(parsed.content).toBe('hello');
    });

    it('should return stringified success result with message', () => {
      const result = success({ count: 5 }, 'Operation completed');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(5);
      expect(parsed.message).toBe('Operation completed');
    });

    it('should return minimal success result when no data provided', () => {
      const result = success();
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('error', () => {
    it('should return stringified error result from string', () => {
      const result = error('Something went wrong');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Something went wrong');
    });

    it('should return stringified error result from Error object', () => {
      const result = error(new Error('Test error'));
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Test error');
    });

    it('should include context in error result', () => {
      const result = error('File not found', { path: '/missing.txt', code: 'ENOENT' });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('File not found');
      expect(parsed.path).toBe('/missing.txt');
      expect(parsed.code).toBe('ENOENT');
    });
  });

  describe('safeTool', () => {
    it('should return success for resolved promise', async () => {
      const result = await safeTool(async () => ({ value: 42 }));
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.value).toBe(42);
    });

    it('should return error for rejected promise', async () => {
      const result = await safeTool(async () => {
        throw new Error('Async failure');
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Async failure');
    });

    it('should include context in error result', async () => {
      const result = await safeTool(
        async () => {
          throw new Error('Task failed');
        },
        { taskId: 'task-123' }
      );
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Task failed');
      expect(parsed.taskId).toBe('task-123');
    });
  });

  describe('safeToolSync', () => {
    it('should return success for successful function', () => {
      const result = safeToolSync(() => ({ computed: 100 }));
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.computed).toBe(100);
    });

    it('should return error for thrown exception', () => {
      const result = safeToolSync(() => {
        throw new Error('Sync failure');
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Sync failure');
    });
  });

  describe('withTiming', () => {
    it('should add timing information to result', () => {
      const startTime = performance.now() - 150;
      const result = withTiming({ data: 'test' }, startTime);
      expect(result.data).toBe('test');
      expect(result._timing).toBeDefined();
      expect(result._timing.durationMs).toBeDefined();
      expect(parseFloat(result._timing.durationMs)).toBeGreaterThan(100);
    });
  });
});
