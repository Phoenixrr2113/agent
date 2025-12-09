import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config, handler } from './delete-session.step.js';

vi.mock('../../lib/session-store.js', () => ({
  hasSession: vi.fn(),
  deleteSession: vi.fn(),
}));

describe('delete-session.step', () => {
  describe('config', () => {
    it('should have correct configuration', () => {
      expect(config.type).toBe('api');
      expect(config.name).toBe('Delete Session');
      expect(config.path).toBe('/sessions/:sessionId');
      expect(config.method).toBe('DELETE');
      expect(config.emits).toContain('session.deleted');
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should delete an existing session', async () => {
      const { hasSession, deleteSession } = await import('../../lib/session-store.js');
      vi.mocked(hasSession).mockReturnValue(true);
      vi.mocked(deleteSession).mockReturnValue(true);

      const mockReq = {
        pathParams: { sessionId: 'test-session' },
      };
      const mockCtx = {
        state: {
          delete: vi.fn().mockResolvedValue(undefined),
        },
        emit: vi.fn().mockResolvedValue(undefined),
        logger: {
          info: vi.fn(),
        },
      };

      const result = await handler(mockReq as any, mockCtx as any);

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ success: true });
      expect(mockCtx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'session.deleted',
        })
      );
    });

    it('should return 404 for non-existent session', async () => {
      const { hasSession } = await import('../../lib/session-store.js');
      vi.mocked(hasSession).mockReturnValue(false);

      const mockReq = {
        pathParams: { sessionId: 'non-existent' },
      };
      const mockCtx = {
        state: { delete: vi.fn() },
        emit: vi.fn(),
        logger: { info: vi.fn() },
      };

      const result = await handler(mockReq as any, mockCtx as any);

      expect(result.status).toBe(404);
      expect(result.body).toEqual({ error: 'Session not found' });
    });
  });
});
