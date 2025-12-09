import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config } from './create-session.step.js';

vi.mock('../../lib/session-store.js', () => ({
  createSession: vi.fn().mockResolvedValue({
    send: vi.fn(),
    getHistory: vi.fn().mockReturnValue([]),
    clearHistory: vi.fn(),
  }),
}));

describe('create-session.step', () => {
  describe('config', () => {
    it('should have correct configuration', () => {
      expect(config.type).toBe('api');
      expect(config.name).toBe('Create Session');
      expect(config.path).toBe('/sessions');
      expect(config.method).toBe('POST');
      expect(config.emits).toContain('session.created');
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should create a new session and return sessionId', async () => {
      const { handler } = await import('./create-session.step.js');
      const mockCtx = {
        state: {
          set: vi.fn().mockResolvedValue(undefined),
        },
        emit: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn(),
        },
      };

      const result = await handler({} as any, mockCtx as any);

      expect(result.status).toBe(201);
      expect(result.body).toHaveProperty('sessionId');
      expect(typeof result.body.sessionId).toBe('string');
      expect(mockCtx.state.set).toHaveBeenCalled();
      expect(mockCtx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'session.created',
        })
      );
    });
  });
});
