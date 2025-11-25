import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgentRuntime } from './agent-runtime.js';

vi.mock('../application/initialization.js', () => ({
  initializeAgent: vi.fn(async () => ({
    tools: {
      ask_user: {
        execute: vi.fn(async (args: { question: string }) => 'default'),
      },
    },
    mcpClients: {},
    usedClients: new Set(),
    codebaseRAG: {
      indexCodebase: vi.fn(async () => {}),
    },
    readline: null,
  })),
  cleanup: vi.fn(),
}));

vi.mock('../application/orchestrator.js', () => ({
  createAgent: vi.fn(() => ({
    generate: vi.fn(async () => ({
      text: 'Test response',
      response: {
        messages: [
          { role: 'user', content: 'Test' },
          { role: 'assistant', content: 'Test response' },
        ],
      },
      steps: [],
    })),
  })),
}));

describe('agent-runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAgentRuntime', () => {
    it('should create a runtime with default configuration', async () => {
      const runtime = await createAgentRuntime();

      expect(runtime).toBeDefined();
      expect(runtime.createSession).toBeDefined();
      expect(runtime.shutdown).toBeDefined();
    });

    it('should allow custom askUserHandler', async () => {
      const customHandler = vi.fn(async (question: string) => 'custom answer');
      const runtime = await createAgentRuntime({
        askUserHandler: customHandler,
      });

      expect(runtime).toBeDefined();
    });
  });

  describe('AgentSession', () => {
    it('should create a session', async () => {
      const runtime = await createAgentRuntime();
      const session = runtime.createSession();

      expect(session).toBeDefined();
      expect(session.send).toBeDefined();
      expect(session.runTask).toBeDefined();
      expect(session.getHistory).toBeDefined();
      expect(session.clearHistory).toBeDefined();
    });

    it('should send a message and get response', async () => {
      const runtime = await createAgentRuntime();
      const session = runtime.createSession();

      const result = await session.send('Test message');

      expect(result).toBeDefined();
      expect(result.text).toBe('Test response');
      expect(result.messages).toBeDefined();
      expect(result.completed).toBe(false);
      expect(result.needsInput).toBe(false);
      expect(result.stepsUsed).toBe(0);
      expect(result.toolsUsed).toEqual([]);
    });

    it('should maintain conversation history', async () => {
      const runtime = await createAgentRuntime();
      const session = runtime.createSession();

      await session.send('First message');
      await session.send('Second message');

      const history = session.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should clear conversation history', async () => {
      const runtime = await createAgentRuntime();
      const session = runtime.createSession();

      await session.send('Test message');
      expect(session.getHistory().length).toBeGreaterThan(0);

      session.clearHistory();
      expect(session.getHistory().length).toBe(0);
    });

    it('should detect completed tasks', async () => {
      const { createAgent } = await import('../application/orchestrator.js');
      vi.mocked(createAgent).mockReturnValue({
        generate: vi.fn(async () => ({
          text: 'Task completed',
          response: {
            messages: [{ role: 'assistant', content: 'Task completed' }],
          },
          steps: [
            {
              toolCalls: [{ toolName: 'task_complete' }],
            },
          ],
        })),
      } as any);

      const runtime = await createAgentRuntime();
      const session = runtime.createSession();
      const result = await session.send('Complete this task');

      expect(result.completed).toBe(true);
    });

    it('should detect when user input is needed', async () => {
      const { createAgent } = await import('../application/orchestrator.js');
      vi.mocked(createAgent).mockReturnValue({
        generate: vi.fn(async () => ({
          text: 'Do you want to continue?',
          response: {
            messages: [{ role: 'assistant', content: 'Do you want to continue?' }],
          },
          steps: [
            {
              toolCalls: [
                {
                  toolName: 'ask_user',
                  args: { question: 'Do you want to continue?' },
                },
              ],
            },
          ],
        })),
      } as any);

      const runtime = await createAgentRuntime();
      const session = runtime.createSession();
      const result = await session.send('Start task');

      expect(result.needsInput).toBe(true);
      expect(result.pendingQuestion).toBe('Do you want to continue?');
    });

    it('should track tools used', async () => {
      const { createAgent } = await import('../application/orchestrator.js');
      vi.mocked(createAgent).mockReturnValue({
        generate: vi.fn(async () => ({
          text: 'Used tools',
          response: {
            messages: [{ role: 'assistant', content: 'Used tools' }],
          },
          steps: [
            {
              toolCalls: [
                { toolName: 'write_file' },
                { toolName: 'read_file' },
              ],
            },
          ],
        })),
      } as any);

      const runtime = await createAgentRuntime();
      const session = runtime.createSession();
      const result = await session.send('Use tools');

      expect(result.toolsUsed).toContain('write_file');
      expect(result.toolsUsed).toContain('read_file');
    });
  });

  describe('shutdown', () => {
    it('should cleanup resources on shutdown', async () => {
      const runtime = await createAgentRuntime();
      await runtime.shutdown();

      const { cleanup } = await import('../application/initialization.js');
      expect(cleanup).toHaveBeenCalled();
    });
  });
});
