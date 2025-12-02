import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSWEBenchTask, resetSession, shutdown, scoreSWEBenchResults, type SWEBenchTask, type SWEBenchConfig, type SWEBenchResult } from './swe-bench.js';

vi.mock('@agent/core', () => ({
  createAgentRuntime: vi.fn().mockResolvedValue({
    createSession: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({
        text: 'Here is the fix:\n```diff\n--- a/file.py\n+++ b/file.py\n@@ -1 +1 @@\n-old\n+new\n```',
        messages: [
          { role: 'user', content: 'Fix the issue' },
          { role: 'assistant', content: 'Here is the fix...' },
        ],
        completed: true,
        toolsUsed: ['file_read', 'file_write'],
      }),
      clearHistory: vi.fn(),
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@agent/shared', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('SWE-bench Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdown();
  });

  describe('runSWEBenchTask', () => {
    it('should run a SWE-bench task successfully', async () => {
      const config: SWEBenchConfig = {};
      const task: SWEBenchTask = {
        instance_id: 'django__django-12345',
        problem_statement: 'Fix the bug in the model',
        repo: 'django/django',
        base_commit: 'abc123',
      };

      const result = await runSWEBenchTask(config, task);

      expect(result.taskId).toBe('django__django-12345');
      expect(result.success).toBe(true);
      expect(result.repo).toBe('django/django');
      expect(result.baseCommit).toBe('abc123');
      expect(result.generatedPatch).toBeDefined();
    });

    it('should extract patch from response', async () => {
      const config: SWEBenchConfig = {};
      const task: SWEBenchTask = {
        instance_id: 'test-001',
        problem_statement: 'Fix something',
        repo: 'test/repo',
        base_commit: 'def456',
      };

      const result = await runSWEBenchTask(config, task);

      expect(result.generatedPatch).toContain('-old');
      expect(result.generatedPatch).toContain('+new');
    });

    it('should include hints when configured', async () => {
      const config: SWEBenchConfig = { includeHints: true };
      const task: SWEBenchTask = {
        instance_id: 'test-002',
        problem_statement: 'Fix the issue',
        repo: 'test/repo',
        base_commit: 'ghi789',
        hints_text: 'Check the validation logic',
      };

      const result = await runSWEBenchTask(config, task);

      expect(result.taskId).toBe('test-002');
      expect(result.success).toBe(true);
    });

    it('should track duration', async () => {
      const config: SWEBenchConfig = {};
      const task: SWEBenchTask = {
        instance_id: 'test-003',
        problem_statement: 'Quick fix',
        repo: 'test/repo',
        base_commit: 'jkl012',
      };

      const result = await runSWEBenchTask(config, task);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resetSession', () => {
    it('should reset the session without error', async () => {
      await expect(resetSession()).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown without error', async () => {
      await expect(shutdown()).resolves.not.toThrow();
    });
  });

  describe('scoreSWEBenchResults', () => {
    it('should calculate resolve rate', () => {
      const results: SWEBenchResult[] = [
        { taskId: '1', success: true, response: '', messages: [], cost: 0, durationMs: 100, toolsUsed: [], repo: 'a/b', baseCommit: 'abc', generatedPatch: 'patch1' },
        { taskId: '2', success: true, response: '', messages: [], cost: 0, durationMs: 100, toolsUsed: [], repo: 'a/b', baseCommit: 'def', generatedPatch: 'patch2' },
        { taskId: '3', success: false, response: '', messages: [], cost: 0, durationMs: 100, toolsUsed: [], repo: 'a/b', baseCommit: 'ghi' },
        { taskId: '4', success: true, response: '', messages: [], cost: 0, durationMs: 100, toolsUsed: [], repo: 'a/b', baseCommit: 'jkl' },
      ];

      const scores = scoreSWEBenchResults(results);

      expect(scores.resolved).toBe(2);
      expect(scores.total).toBe(4);
      expect(scores.resolveRate).toBe(0.5);
    });

    it('should handle empty results', () => {
      const scores = scoreSWEBenchResults([]);

      expect(scores.resolved).toBe(0);
      expect(scores.total).toBe(0);
      expect(scores.resolveRate).toBe(0);
    });
  });
});

