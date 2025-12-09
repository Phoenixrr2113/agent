import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config } from './chat.step.js';

vi.mock('../../lib/session-store.js', () => ({
  getSession: vi.fn(),
}));

describe('chat.step', () => {
  describe('config', () => {
    it('should have correct configuration', () => {
      expect(config.type).toBe('api');
      expect(config.name).toBe('Chat');
      expect(config.path).toBe('/sessions/:sessionId/chat');
      expect(config.method).toBe('POST');
      expect(config.emits).toContain('chat.started');
      expect(config.emits).toContain('chat.completed');
      expect(config.emits).toContain('memory.extract');
    });

    it('should have body schema that validates message', () => {
      expect(config.bodySchema).toBeDefined();
      const validResult = config.bodySchema?.safeParse({ message: 'Hello' });
      expect(validResult?.success).toBe(true);

      const invalidResult = config.bodySchema?.safeParse({ message: '' });
      expect(invalidResult?.success).toBe(false);
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return 404 for non-existent session', async () => {
      const { getSession } = await import('../../lib/session-store.js');
      const { handler } = await import('./chat.step.js');
      vi.mocked(getSession).mockReturnValue(undefined);

      const mockReq = {
        pathParams: { sessionId: 'non-existent' },
        body: { message: 'Hello' },
      };
      const mockCtx = {
        emit: vi.fn(),
        logger: { info: vi.fn() },
      };

      const result = await handler(mockReq as any, mockCtx as any);

      expect(result.status).toBe(404);
      expect(result.body).toEqual({ error: 'Session not found' });
    });

    it('should process chat and return result', async () => {
      const { getSession } = await import('../../lib/session-store.js');
      const { handler } = await import('./chat.step.js');

      const mockSession = {
        send: vi.fn().mockResolvedValue({
          text: 'AI response',
          completed: true,
          needsInput: false,
          pendingQuestion: undefined,
          stepsUsed: 2,
          toolsUsed: ['shell'],
        }),
        getHistory: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getSession).mockReturnValue(mockSession as any);

      const mockReq = {
        pathParams: { sessionId: 'test-session' },
        body: { message: 'Run ls command' },
      };
      const mockCtx = {
        emit: vi.fn().mockResolvedValue(undefined),
        logger: { info: vi.fn() },
      };

      const result = await handler(mockReq as any, mockCtx as any);

      expect(result.status).toBe(200);
      expect(result.body.text).toBe('AI response');
      expect(result.body.completed).toBe(true);
      expect(result.body.stepsUsed).toBe(2);
      expect(result.body.toolsUsed).toContain('shell');
      expect(mockCtx.emit).toHaveBeenCalledTimes(3);
    });
  });
});
