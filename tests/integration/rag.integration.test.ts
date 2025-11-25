import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCodebaseRAG } from '../../src/core/rag/index.js';
import { setupTestWorkspace, teardownTestWorkspace, writeTestFile } from '../helpers/test-utils.js';

const hasGoogleAIKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

describe.skipIf(!hasGoogleAIKey)('RAG integration tests', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await setupTestWorkspace('rag-integration');
  });

  afterEach(async () => {
    await teardownTestWorkspace(workspace);
  });

  it('should index real TypeScript files', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const stats = rag.getStats();
    expect(stats.totalChunks).toBeGreaterThan(0);
    expect(stats.files).toBeGreaterThan(0);
  });

  it('should search for function definitions using real embeddings', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('calculate sum of two numbers', 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('calculateSum');
  });

  it('should search for class definitions', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('mathematical operations class', 5);

    expect(results.length).toBeGreaterThan(0);
    const hasMatch = results.some(r =>
      r.content.includes('MathOperations') || r.content.includes('DataProcessor')
    );
    expect(hasMatch).toBe(true);
  });

  it('should search across multiple file types', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('data processing', 10);

    expect(results.length).toBeGreaterThan(0);
    const fileTypes = new Set(results.map(r => r.filePath.split('.').pop()));
    expect(fileTypes.size).toBeGreaterThan(1);
  });

  it('should return chunks with correct metadata', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('calculate', 3);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('filePath');
    expect(results[0]).toHaveProperty('startLine');
    expect(results[0]).toHaveProperty('endLine');
    expect(results[0]).toHaveProperty('content');
    expect(results[0]).toHaveProperty('embedding');
  });

  it('should respect topK parameter', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('function', 2);

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should filter by similarity threshold', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('quantum mechanics physics', 5, 0.9);

    expect(results.length).toBe(0);
  });

  it('should handle re-indexing after file additions', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();
    const initialStats = rag.getStats();

    await writeTestFile(workspace, 'new-file.ts', 'export const newFunction = () => "test";');

    await rag.indexCodebase();
    const newStats = rag.getStats();

    expect(newStats.totalChunks).toBeGreaterThanOrEqual(initialStats.totalChunks);
  });

  it('should chunk large files appropriately', async () => {
    const largeCode = Array(300)
      .fill(null)
      .map((_, i) => `export const var${i} = ${i};`)
      .join('\n');

    await writeTestFile(workspace, 'large-file.ts', largeCode);

    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('variable', 50);

    expect(results.length).toBeGreaterThan(1);
  });

  it('should find semantically similar code', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('add two numbers together', 5);

    expect(results.length).toBeGreaterThan(0);
    const hasAddition = results.some(r =>
      r.content.includes('add') ||
      r.content.includes('sum') ||
      r.content.includes('+')
    );
    expect(hasAddition).toBe(true);
  });

  it('should handle empty workspace gracefully', async () => {
    const emptyWorkspace = await setupTestWorkspace('empty-rag');
    try {
      const rag = createCodebaseRAG(emptyWorkspace);
      await rag.indexCodebase();

      const stats = rag.getStats();
      expect(stats.totalChunks).toBe(0);
      expect(stats.files).toBe(0);

      const results = await rag.searchCodebase('anything', 5);
      expect(results).toEqual([]);
    } finally {
      await teardownTestWorkspace(emptyWorkspace);
    }
  });
});
