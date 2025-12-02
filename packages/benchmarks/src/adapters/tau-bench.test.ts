import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTauBenchAgent, runTauBenchTask, shutdown, type TauBenchConfig } from './tau-bench.js';
import type { TauBenchMessage } from '../types.js';

vi.mock('@agent/core', () => ({
  createAgentRuntime: vi.fn().mockImplementation(async () => ({
    createSession: () => ({
      send: vi.fn().mockResolvedValue({
        text: 'I can help you with that return.',
        messages: [
          { role: 'user', content: 'I want to return my order' },
          { role: 'assistant', content: 'I can help you with that return.' },
        ],
        completed: true,
        toolsUsed: ['get_order_details'],
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

describe('Tau-bench Adapter', () => {
  beforeEach(async () => {
    await shutdown();
  });

  afterEach(async () => {
    await shutdown();
    vi.clearAllMocks();
  });

  describe('createTauBenchAgent', () => {
    it('should create a callable agent for retail domain', async () => {
      const config: TauBenchConfig = {
        domain: 'retail',
      };

      const agent = await createTauBenchAgent(config);

      expect(typeof agent).toBe('function');
    });

    it('should create a callable agent for airline domain', async () => {
      const config: TauBenchConfig = {
        domain: 'airline',
      };

      const agent = await createTauBenchAgent(config);

      expect(typeof agent).toBe('function');
    });

    it('should return a tool_call action when tools are used', async () => {
      const config: TauBenchConfig = {
        domain: 'retail',
      };

      const agent = await createTauBenchAgent(config);
      const messages: TauBenchMessage[] = [
        { role: 'user', content: 'I want to return order #12345' },
      ];
      const tools = [
        { name: 'get_order_details', description: 'Get order details', parameters: {} },
      ];

      const action = await agent(messages, tools);

      expect(action.type).toBe('tool_call');
      expect(action.toolCalls).toBeDefined();
      expect(action.toolCalls!.length).toBeGreaterThan(0);
    });
  });

  describe('runTauBenchTask', () => {
    it('should run a task and return a BenchmarkResult', async () => {
      const config: TauBenchConfig = {
        domain: 'retail',
      };
      const task = {
        id: 'retail-001',
        messages: [{ role: 'user' as const, content: 'I want to return my order' }],
        tools: [{ name: 'initiate_return', description: 'Start a return', parameters: {} }],
      };

      const result = await runTauBenchTask(config, task);

      expect(result.taskId).toBe('retail-001');
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should track tools used', async () => {
      const config: TauBenchConfig = {
        domain: 'retail',
      };
      const task = {
        id: 'retail-002',
        messages: [{ role: 'user' as const, content: 'Check my order status' }],
        tools: [{ name: 'get_order_status', description: 'Get status', parameters: {} }],
      };

      const result = await runTauBenchTask(config, task);

      expect(Array.isArray(result.toolsUsed)).toBe(true);
    });

    it('should include messages in result', async () => {
      const config: TauBenchConfig = {
        domain: 'airline',
      };
      const task = {
        id: 'airline-001',
        messages: [{ role: 'user' as const, content: 'Book me a flight' }],
        tools: [],
      };

      const result = await runTauBenchTask(config, task);

      expect(Array.isArray(result.messages)).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should shutdown the runtime without errors', async () => {
      await expect(shutdown()).resolves.not.toThrow();
    });

    it('should handle multiple shutdown calls', async () => {
      await shutdown();
      await expect(shutdown()).resolves.not.toThrow();
    });
  });
});

