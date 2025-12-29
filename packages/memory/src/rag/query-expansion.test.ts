import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn((model: string) => ({ modelId: model }))),
}));

import { generateObject } from 'ai';
import { expandQuery, combineExpandedResults } from './query-expansion.js';

describe('query-expansion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('expandQuery', () => {
    it('returns empty expansion when disabled', async () => {
      const result = await expandQuery('test query', { enabled: false });

      expect(result).toEqual({
        original: 'test query',
        expanded: [],
        keywords: [],
      });
      expect(generateObject).not.toHaveBeenCalled();
    });

    it('expands query using LLM', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          expandedQueries: ['auth flow', 'login process', 'session management'],
          keywords: ['authentication', 'login', 'session', 'token'],
        },
        rawResponse: undefined,
        request: {},
        response: {} as any,
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: [],
        toJsonResponse: vi.fn(),
        experimental_providerMetadata: undefined,
      } as any);

      const result = await expandQuery('authentication');

      expect(result.original).toBe('authentication');
      expect(result.expanded).toHaveLength(3);
      expect(result.expanded).toContain('auth flow');
      expect(result.keywords).toContain('token');
    });

    it('respects maxExpansions config', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          expandedQueries: ['query1', 'query2', 'query3', 'query4', 'query5'],
          keywords: ['kw1'],
        },
        rawResponse: undefined,
        request: {},
        response: {} as any,
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        warnings: [],
        toJsonResponse: vi.fn(),
        experimental_providerMetadata: undefined,
      } as any);

      const result = await expandQuery('test', { maxExpansions: 2 });

      expect(result.expanded).toHaveLength(2);
    });
  });

  describe('combineExpandedResults', () => {
    it('prioritizes original query results', () => {
      const resultsByQuery = new Map<string, Array<{ id: string; score: number }>>([
        ['original', [{ id: 'a', score: 0.9 }, { id: 'b', score: 0.8 }]],
        ['expanded1', [{ id: 'c', score: 0.95 }, { id: 'a', score: 0.85 }]],
      ]);

      const combined = combineExpandedResults(resultsByQuery, 'original');

      expect(combined[0]?.id).toBe('a');
      expect(combined[1]?.id).toBe('b');
      expect(combined[2]?.id).toBe('c');
      expect(combined).toHaveLength(3);
    });

    it('deduplicates results by id', () => {
      const resultsByQuery = new Map<string, Array<{ id: string; score: number }>>([
        ['q1', [{ id: 'a', score: 0.9 }]],
        ['q2', [{ id: 'a', score: 0.8 }, { id: 'b', score: 0.7 }]],
      ]);

      const combined = combineExpandedResults(resultsByQuery, 'q1');

      expect(combined).toHaveLength(2);
      expect(combined.filter(r => r.id === 'a')).toHaveLength(1);
    });

    it('handles empty result sets', () => {
      const resultsByQuery = new Map<string, Array<{ id: string; score: number }>>();
      const combined = combineExpandedResults(resultsByQuery, 'missing');

      expect(combined).toEqual([]);
    });
  });
});
