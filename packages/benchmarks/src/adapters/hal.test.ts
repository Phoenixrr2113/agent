import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run, shutdown, resetSession, type HALAgentArgs } from './hal.js';
import type { BenchmarkTask } from '../types.js';

vi.mock('@agent/core', () => ({
  createAgentRuntime: vi.fn().mockImplementation(async () => ({
    createSession: () => ({
      send: vi.fn().mockResolvedValue({
        text: 'Mocked response',
        messages: [
          { role: 'user', content: 'Test prompt' },
          { role: 'assistant', content: 'Mocked response' },
        ],
        completed: true,
        toolsUsed: ['mock_tool'],
      }),
      clearHistory: vi.fn(),
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@agent/shared', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('HAL Adapter', () => {
  beforeEach(async () => {
    await shutdown();
  });

  afterEach(async () => {
    await shutdown();
    vi.clearAllMocks();
  });

  describe('run', () => {
    it('should execute a task and return HAL-formatted results', async () => {
      const task: BenchmarkTask = {
        id: 'test-task-1',
        prompt: 'What is 2 + 2?',
      };

      const result = await run('test-task-1', task, {});

      expect(result).toHaveProperty('test-task-1');
      expect(result['test-task-1']).toHaveProperty('history');
      expect(result['test-task-1']).toHaveProperty('cost');
      expect(Array.isArray(result['test-task-1'].history)).toBe(true);
    });

    it('should handle task with instruction instead of prompt', async () => {
      const task: BenchmarkTask = {
        id: 'test-task-2',
        instruction: 'List all files',
      };

      const result = await run('test-task-2', task, {});

      expect(result).toHaveProperty('test-task-2');
      expect(result['test-task-2'].history.length).toBeGreaterThan(0);
    });

    it('should throw error when task has no prompt or instruction', async () => {
      const task: BenchmarkTask = {
        id: 'test-task-3',
      };

      const result = await run('test-task-3', task, {});

      expect(result['test-task-3'].history[0].content).toContain('Error');
      expect(result['test-task-3'].history[0].content).toContain('prompt or instruction');
    });

    it('should accept workspace option', async () => {
      const task: BenchmarkTask = {
        id: 'test-task-4',
        prompt: 'Analyze the codebase',
      };
      const args: HALAgentArgs = {
        workspace: '/path/to/workspace',
      };

      const result = await run('test-task-4', task, args);

      expect(result).toHaveProperty('test-task-4');
    });

    it('should set cost to 0', async () => {
      const task: BenchmarkTask = {
        id: 'test-task-5',
        prompt: 'Test',
      };

      const result = await run('test-task-5', task, {});

      expect(result['test-task-5'].cost).toBe(0);
    });
  });

  describe('resetSession', () => {
    it('should reset the session without errors', async () => {
      const task: BenchmarkTask = {
        id: 'test-reset',
        prompt: 'First message',
      };
      await run('test-reset', task, {});

      await expect(resetSession()).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown the runtime without errors', async () => {
      const task: BenchmarkTask = {
        id: 'test-shutdown',
        prompt: 'Test',
      };
      await run('test-shutdown', task, {});

      await expect(shutdown()).resolves.not.toThrow();
    });

    it('should handle multiple shutdown calls', async () => {
      await shutdown();
      await expect(shutdown()).resolves.not.toThrow();
    });
  });
});

