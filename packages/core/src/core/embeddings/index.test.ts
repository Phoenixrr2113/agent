import { logger } from '@agent/shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { cosineSimilarity } from ".";

vi.mock('@agent/shared', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('cosineSimilarity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate cosine similarity for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    const result = cosineSimilarity(a, b);
    expect(result).toBeCloseTo(1.0);
  });

  it('should calculate cosine similarity for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    const result = cosineSimilarity(a, b);
    expect(result).toBeCloseTo(0.0);
  });

  it('should warn and return 0 for empty vectors', () => {
    const a: number[] = [];
    const b = [1, 2, 3];
    const result = cosineSimilarity(a, b);

    expect(result).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'Cosine similarity called with empty embedding vector'
    );
  });

  it('should warn and return 0 for dimension mismatch', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3, 4];
    const result = cosineSimilarity(a, b);

    expect(result).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'Embedding dimension mismatch - vectors have different lengths',
      {
        lengthA: 3,
        lengthB: 4,
      }
    );
  });

  it('should return 0 for zero-length vectors', () => {
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    const result = cosineSimilarity(a, b);
    expect(result).toBe(0);
  });

  it('should calculate negative similarity for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    const result = cosineSimilarity(a, b);
    expect(result).toBeCloseTo(-1.0);
  });
});
