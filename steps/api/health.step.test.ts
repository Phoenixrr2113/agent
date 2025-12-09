import { describe, it, expect, vi } from 'vitest';
import { config, handler } from './health.step.js';

describe('health.step', () => {
  describe('config', () => {
    it('should have correct configuration', () => {
      expect(config.type).toBe('api');
      expect(config.name).toBe('Health Check');
      expect(config.path).toBe('/health');
      expect(config.method).toBe('GET');
      expect(config.emits).toEqual([]);
    });
  });

  describe('handler', () => {
    it('should return ok status', async () => {
      const mockCtx = {
        logger: {
          info: vi.fn(),
        },
      };

      const result = await handler({} as any, mockCtx as any);

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ status: 'ok' });
      expect(mockCtx.logger.info).toHaveBeenCalledWith('Health check requested');
    });
  });
});
