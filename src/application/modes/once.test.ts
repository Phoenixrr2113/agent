import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runOnceMode } from './once.js';

const mockMkdir = vi.fn();
const mockAppendFile = vi.fn();

vi.mock('fs/promises', () => ({
  default: {
    mkdir: (...args: any[]) => mockMkdir(...args),
    appendFile: (...args: any[]) => mockAppendFile(...args),
  },
  mkdir: (...args: any[]) => mockMkdir(...args),
  appendFile: (...args: any[]) => mockAppendFile(...args),
}));

const mockCleanup = vi.fn();
vi.mock('../initialization.js', () => ({
  cleanup: (...args: any[]) => mockCleanup(...args),
}));

vi.mock('../../core/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    setLevel: vi.fn(),
  },
}));

describe('once mode', () => {
  let mockAgent: any;
  let mockMcpClients: any;
  let mockUsedClients: Set<string>;
  let mockCodebaseRAG: any;
  let mockReadline: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAgent = {
      generate: vi.fn().mockResolvedValue({
        text: 'Agent response',
        response: {
          messages: [{ role: 'assistant', content: 'Agent response' }],
        },
        steps: [
          {
            text: 'Step 1',
            toolCalls: [{ toolName: 'tool1', args: { arg: 'value' } }],
            toolResults: [{ toolName: 'tool1', result: 'result' }],
            finishReason: 'stop',
          },
        ],
        totalUsage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
        usage: { reasoningTokens: 10 },
        reasoningText: 'Reasoning',
      }),
    };

    mockMcpClients = {
      filesystem: { close: vi.fn() },
      git: { close: vi.fn() },
    };

    mockUsedClients = new Set();

    mockCodebaseRAG = {
      indexCodebase: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({ totalChunks: 10, files: 2 }),
    };

    mockReadline = {
      close: vi.fn(),
    };

    mockMkdir.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);
  });

  describe('runOnceMode', () => {
    it('should create logs directory', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      expect(mockMkdir).toHaveBeenCalledWith('./logs', { recursive: true });
    });

    it('should call agent.generate with correct prompt', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      expect(mockAgent.generate).toHaveBeenCalledWith({
        prompt: expect.stringContaining('generic agent template'),
      });
    });

    it('should print agent response via logger', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      const { logger } = await import('../../core/logger.js');
      expect(logger.info).toHaveBeenCalledWith('Agent response');
    });

    it('should log response to agent.log file', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      expect(mockAppendFile).toHaveBeenCalledWith(
        './logs/agent.log',
        expect.stringContaining('Agent response')
      );
    });

    it('should log structured data to iterations.jsonl', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      expect(mockAppendFile).toHaveBeenCalledWith(
        './logs/iterations.jsonl',
        expect.stringContaining('"text"')
      );
    });

    it('should include timestamp in logs', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      const callArg = mockAppendFile.mock.calls.find(
        call => call[0] === './logs/iterations.jsonl'
      )?.[1];

      expect(callArg).toBeDefined();
      const logEntry = JSON.parse(callArg);
      expect(logEntry.timestamp).toBeDefined();
      expect(new Date(logEntry.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('should include reasoning text in logs', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      const callArg = mockAppendFile.mock.calls.find(
        call => call[0] === './logs/iterations.jsonl'
      )?.[1];

      expect(callArg).toBeDefined();
      const logEntry = JSON.parse(callArg);
      expect(logEntry.reasoningText).toBe('Reasoning');
    });

    it('should include steps in logs', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      const callArg = mockAppendFile.mock.calls.find(
        call => call[0] === './logs/iterations.jsonl'
      )?.[1];

      expect(callArg).toBeDefined();
      const logEntry = JSON.parse(callArg);
      expect(logEntry.steps).toHaveLength(1);
      expect(logEntry.steps[0].text).toBe('Step 1');
    });

    it('should include usage stats in logs', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      const callArg = mockAppendFile.mock.calls.find(
        call => call[0] === './logs/iterations.jsonl'
      )?.[1];

      expect(callArg).toBeDefined();
      const logEntry = JSON.parse(callArg);
      expect(logEntry.usage.totalTokens).toBe(100);
      expect(logEntry.usage.reasoningTokens).toBe(10);
    });

    it('should truncate long tool results', async () => {
      mockAgent.generate.mockResolvedValueOnce({
        text: 'Response',
        steps: [
          {
            toolResults: [
              {
                toolName: 'tool1',
                result: 'x'.repeat(300),
              },
            ],
          },
        ],
        totalUsage: {},
        usage: {},
      });

      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      const callArg = mockAppendFile.mock.calls.find(
        call => call[0] === './logs/iterations.jsonl'
      )?.[1];

      expect(callArg).toBeDefined();
      const logEntry = JSON.parse(callArg);
      expect(logEntry.steps[0].toolResults[0].result).toHaveLength(200);
    });

    it('should re-index codebase after agent run', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      expect(mockCodebaseRAG.indexCodebase).toHaveBeenCalled();
      expect(mockCodebaseRAG.getStats).toHaveBeenCalled();
    });

    it('should print re-indexing stats via logger', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      const { logger } = await import('../../core/logger.js');
      expect(logger.info).toHaveBeenCalledWith('Re-indexing codebase after agent run...');
      expect(logger.info).toHaveBeenCalledWith('RAG re-indexed', { chunks: 10, files: 2 });
    });

    it('should call cleanup at the end', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      expect(mockCleanup).toHaveBeenCalledWith(
        mockMcpClients,
        mockUsedClients,
        mockReadline
      );
    });

    it('should handle null readline interface', async () => {
      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, null);

      expect(mockCleanup).toHaveBeenCalledWith(
        mockMcpClients,
        mockUsedClients,
        null
      );
    });

    it('should handle agent with no reasoning text', async () => {
      mockAgent.generate.mockResolvedValueOnce({
        text: 'Response',
        steps: [],
        totalUsage: {},
        usage: {},
      });

      await expect(
        runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline)
      ).resolves.not.toThrow();
    });

    it('should handle steps with no tool calls', async () => {
      mockAgent.generate.mockResolvedValueOnce({
        text: 'Response',
        steps: [{ text: 'Step' }],
        totalUsage: {},
        usage: {},
      });

      await runOnceMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      const callArg = mockAppendFile.mock.calls.find(
        call => call[0] === './logs/iterations.jsonl'
      )?.[1];

      expect(callArg).toBeDefined();
      const logEntry = JSON.parse(callArg);
      expect(logEntry.steps[0].toolCalls).toBeUndefined();
    });
  });
});
