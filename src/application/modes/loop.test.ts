import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runLoopMode } from './loop.js';

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

vi.mock('../initialization.js', () => ({
  cleanup: vi.fn(),
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

describe('loop mode', () => {
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
        steps: [],
        totalUsage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
        usage: {},
      }),
    };

    mockMcpClients = {
      filesystem: { close: vi.fn() },
      git: { close: vi.fn() },
    };

    mockUsedClients = new Set();
    mockCodebaseRAG = {};
    mockReadline = {
      question: vi.fn().mockResolvedValue('exit'),
      close: vi.fn(),
    };

    mockMkdir.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);

    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  describe('runLoopMode', () => {
    it('should create logs directory', async () => {
      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMkdir).toHaveBeenCalledWith('./logs', { recursive: true });
    });

    it('should display welcome message via logger', async () => {
      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { logger } = await import('../../core/logger.js');
      expect(logger.info).toHaveBeenCalledWith('🤖 Generic Agent Template - Interactive Mode');
    });

    it('should initialize with system message', async () => {
      mockReadline.question.mockResolvedValueOnce('test input').mockResolvedValueOnce('exit');

      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('generic agent template'),
            }),
          ]),
        })
      );
    });

    it('should handle exit command', async () => {
      mockReadline.question.mockResolvedValue('exit');

      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle quit command', async () => {
      mockReadline.question.mockResolvedValue('quit');

      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should skip empty input', async () => {
      mockReadline.question.mockResolvedValueOnce('   ').mockResolvedValueOnce('exit');

      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 200));

      const generateCalls = mockAgent.generate.mock.calls;
      expect(generateCalls.length).toBeLessThanOrEqual(2);
    });

    it('should log agent responses to file', async () => {
      mockReadline.question.mockResolvedValueOnce('test').mockResolvedValueOnce('exit');

      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(mockAppendFile).toHaveBeenCalledWith(
        './logs/agent.log',
        expect.stringContaining('Agent response')
      );
    });

    it('should log structured data to JSONL', async () => {
      mockReadline.question.mockResolvedValueOnce('test').mockResolvedValueOnce('exit');

      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(mockAppendFile).toHaveBeenCalledWith(
        './logs/iterations.jsonl',
        expect.stringContaining('"text"')
      );
    });

    it('should handle agent errors gracefully', async () => {
      mockAgent.generate.mockRejectedValueOnce(new Error('Test error'));
      mockReadline.question.mockResolvedValueOnce('test').mockResolvedValueOnce('exit');

      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 300));

      const { logger } = await import('../../core/logger.js');
      expect(logger.error).toHaveBeenCalledWith('❌ Error', { message: 'Test error' });
      expect(mockAppendFile).toHaveBeenCalledWith(
        './logs/agent.log',
        expect.stringContaining('ERROR')
      );
    });

    it('should break loop when readline is null', async () => {
      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, null);

      await new Promise(resolve => setTimeout(resolve, 200));

      const { logger } = await import('../../core/logger.js');
      expect(logger.error).toHaveBeenCalledWith('Readline interface not initialized');
    });

    it('should handle fatal errors in chat loop', async () => {
      mockReadline.question.mockRejectedValue(new Error('Fatal error'));

      const promise = runLoopMode(mockAgent, mockMcpClients, mockUsedClients, mockCodebaseRAG, mockReadline);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
