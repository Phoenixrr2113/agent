import { describe, it, expect, beforeEach } from 'vitest';
import { createBM25Index, reciprocalRankFusion, mergeSearchResults } from './bm25.js';

describe('BM25Index', () => {
  let index: ReturnType<typeof createBM25Index>;

  beforeEach(() => {
    index = createBM25Index();
  });

  it('should add and search documents', () => {
    index.addDocument({ id: '1', content: 'hello world' });
    index.addDocument({ id: '2', content: 'goodbye world' });
    index.addDocument({ id: '3', content: 'hello universe' });
    index.consolidate();

    const results = index.search('hello', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === '1')).toBe(true);
    expect(results.some((r) => r.id === '3')).toBe(true);
  });

  it('should weight name field higher', () => {
    index.addDocument({ id: '1', content: 'some random text', name: 'calculateSum' });
    index.addDocument({ id: '2', content: 'calculateSum is a function', name: 'other' });
    index.addDocument({ id: '3', content: 'unrelated stuff here', name: 'unrelated' });
    index.consolidate();

    const results = index.search('calculateSum', 10);
    expect(results[0].id).toBe('1');
  });

  it('should return empty array for no matches', () => {
    index.addDocument({ id: '1', content: 'hello world' });
    index.addDocument({ id: '2', content: 'goodbye world' });
    index.addDocument({ id: '3', content: 'another document' });
    index.consolidate();

    const results = index.search('xyz123nonexistent', 10);
    expect(results).toHaveLength(0);
  });

  it('should track document count', () => {
    expect(index.getDocumentCount()).toBe(0);
    index.addDocument({ id: '1', content: 'hello' });
    expect(index.getDocumentCount()).toBe(1);
    index.addDocuments([
      { id: '2', content: 'world' },
      { id: '3', content: 'test' },
    ]);
    expect(index.getDocumentCount()).toBe(3);
  });

  it('should throw when adding after consolidation', () => {
    index.addDocument({ id: '1', content: 'hello' });
    index.addDocument({ id: '2', content: 'world' });
    index.addDocument({ id: '3', content: 'test' });
    index.consolidate();
    expect(() => index.addDocument({ id: '4', content: 'new' })).toThrow(
      'Cannot add documents after consolidation'
    );
  });

  it('should auto-consolidate on search', () => {
    index.addDocument({ id: '1', content: 'hello world' });
    index.addDocument({ id: '2', content: 'goodbye world' });
    index.addDocument({ id: '3', content: 'hello universe' });
    const results = index.search('hello', 10);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('reciprocalRankFusion', () => {
  it('should merge rankings from multiple sources', () => {
    const ranking1 = new Map([
      ['doc1', 1],
      ['doc2', 2],
    ]);
    const ranking2 = new Map([
      ['doc2', 1],
      ['doc3', 2],
    ]);

    const merged = reciprocalRankFusion([ranking1, ranking2]);

    expect(merged.get('doc2')).toBeGreaterThan(merged.get('doc1')!);
    expect(merged.get('doc2')).toBeGreaterThan(merged.get('doc3')!);
  });

  it('should handle documents appearing in only one ranking', () => {
    const ranking1 = new Map([['doc1', 1]]);
    const ranking2 = new Map([['doc2', 1]]);

    const merged = reciprocalRankFusion([ranking1, ranking2]);

    expect(merged.has('doc1')).toBe(true);
    expect(merged.has('doc2')).toBe(true);
    expect(merged.get('doc1')).toBe(merged.get('doc2'));
  });
});

describe('mergeSearchResults', () => {
  it('should combine embedding and BM25 results', () => {
    const embeddingResults = [
      { id: 'doc1', rank: 1 },
      { id: 'doc2', rank: 2 },
    ];
    const bm25Results = [
      { id: 'doc2', score: 5.0, rank: 1 },
      { id: 'doc3', score: 3.0, rank: 2 },
    ];

    const merged = mergeSearchResults(embeddingResults, bm25Results);

    expect(merged[0].id).toBe('doc2');
    expect(merged.length).toBe(3);
  });

  it('should respect weights', () => {
    const embeddingResults = [{ id: 'doc1', rank: 1 }];
    const bm25Results = [{ id: 'doc2', score: 5.0, rank: 1 }];

    const mergedEqWeight = mergeSearchResults(embeddingResults, bm25Results, {
      embeddingWeight: 1,
      bm25Weight: 1,
    });
    const mergedBm25Heavy = mergeSearchResults(embeddingResults, bm25Results, {
      embeddingWeight: 0.5,
      bm25Weight: 2.0,
    });

    expect(mergedEqWeight[0].score).toBe(mergedEqWeight[1].score);
    expect(mergedBm25Heavy.find((r) => r.id === 'doc2')!.score).toBeGreaterThan(
      mergedBm25Heavy.find((r) => r.id === 'doc1')!.score
    );
  });
});

