import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runGAIATask, resetSession, shutdown, scoreGAIAResults, type GAIATask, type GAIAConfig, type GAIAResult } from './gaia.js';

vi.mock('@agent/core', () => ({
  createAgentRuntime: vi.fn().mockResolvedValue({
    createSession: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({
        text: 'The answer is 42',
        messages: [
          { role: 'user', content: 'What is the answer?' },
          { role: 'assistant', content: 'The answer is 42' },
        ],
        completed: true,
        toolsUsed: ['calculator'],
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

describe('GAIA Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdown();
  });

  describe('runGAIATask', () => {
    it('should run a GAIA task successfully', async () => {
      const config: GAIAConfig = { level: 1 };
      const task: GAIATask = {
        task_id: 'gaia-001',
        Question: 'What is the answer to life, the universe, and everything?',
        Level: 1,
        'Final answer': '42',
      };

      const result = await runGAIATask(config, task);

      expect(result.taskId).toBe('gaia-001');
      expect(result.success).toBe(true);
      expect(result.level).toBe(1);
      expect(result.response).toBe('The answer is 42');
      expect(result.messages).toHaveLength(2);
    });

    it('should check correctness when expected answer is provided', async () => {
      const config: GAIAConfig = { level: 1 };
      const task: GAIATask = {
        task_id: 'gaia-002',
        Question: 'What is 6 times 7?',
        Level: 1,
        'Final answer': '42',
      };

      const result = await runGAIATask(config, task);

      expect(result.isCorrect).toBe(true);
      expect(result.expectedAnswer).toBe('42');
    });

    it('should handle tasks with associated files', async () => {
      const config: GAIAConfig = { level: 2, dataDir: '/data' };
      const task: GAIATask = {
        task_id: 'gaia-003',
        Question: 'Analyze the attached file',
        Level: 2,
        file_path: 'data.csv',
      };

      const result = await runGAIATask(config, task);

      expect(result.taskId).toBe('gaia-003');
      expect(result.level).toBe(2);
    });

    it('should track duration', async () => {
      const config: GAIAConfig = {};
      const task: GAIATask = {
        task_id: 'gaia-004',
        Question: 'Quick question',
        Level: 1,
      };

      const result = await runGAIATask(config, task);

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

  describe('scoreGAIAResults', () => {
    it('should calculate scores by level', () => {
      const results: GAIAResult[] = [
        { taskId: '1', success: true, response: '', messages: [], cost: 0, durationMs: 100, toolsUsed: [], level: 1, isCorrect: true },
        { taskId: '2', success: true, response: '', messages: [], cost: 0, durationMs: 100, toolsUsed: [], level: 1, isCorrect: false },
        { taskId: '3', success: true, response: '', messages: [], cost: 0, durationMs: 100, toolsUsed: [], level: 2, isCorrect: true },
        { taskId: '4', success: true, response: '', messages: [], cost: 0, durationMs: 100, toolsUsed: [], level: 3, isCorrect: true },
      ];

      const scores = scoreGAIAResults(results);

      expect(scores.overall).toBe(0.75);
      expect(scores.byLevel[1]).toBe(0.5);
      expect(scores.byLevel[2]).toBe(1);
      expect(scores.byLevel[3]).toBe(1);
    });

    it('should handle empty results', () => {
      const scores = scoreGAIAResults([]);

      expect(scores.overall).toBe(0);
      expect(scores.byLevel[1]).toBe(0);
      expect(scores.byLevel[2]).toBe(0);
      expect(scores.byLevel[3]).toBe(0);
    });
  });
});

