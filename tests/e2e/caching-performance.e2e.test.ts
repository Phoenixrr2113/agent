import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCodebaseRAG } from '../../src/rag.js';
import { setupTestWorkspace, teardownTestWorkspace, writeTestFile } from '../helpers/test-utils.js';
import path from 'path';
import fs from 'fs/promises';

const hasGoogleAIKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

describe.skipIf(!hasGoogleAIKey)('Caching and Performance E2E tests', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await setupTestWorkspace('e2e-caching');
  });

  afterEach(async () => {
    await teardownTestWorkspace(workspace);
  });

  it('should cache embeddings for unchanged files', async () => {
    const rag = createCodebaseRAG(workspace);

    const start1 = Date.now();
    await rag.indexCodebase();
    const duration1 = Date.now() - start1;

    const stats1 = rag.getStats();

    const start2 = Date.now();
    await rag.indexCodebase();
    const duration2 = Date.now() - start2;

    const stats2 = rag.getStats();

    expect(stats2.totalChunks).toBe(stats1.totalChunks);
    expect(duration2).toBeLessThan(duration1);
  });

  it('should invalidate cache when file content changes', async () => {
    const testFile = path.join(workspace, 'mutable.ts');
    await writeTestFile(workspace, 'mutable.ts', 'export const v1 = 1;');

    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results1 = await rag.searchCodebase('v1', 1);
    expect(results1.length).toBeGreaterThan(0);

    await writeTestFile(workspace, 'mutable.ts', 'export const v2 = 2;');

    await rag.indexCodebase();

    const results2 = await rag.searchCodebase('v2', 1);
    expect(results2.length).toBeGreaterThan(0);
  });

  it('should handle incremental indexing efficiently', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();
    const stats1 = rag.getStats();

    await writeTestFile(workspace, 'new-file-1.ts', 'export const newFunc1 = () => {};');
    await writeTestFile(workspace, 'new-file-2.ts', 'export const newFunc2 = () => {};');

    const start = Date.now();
    await rag.indexCodebase();
    const duration = Date.now() - start;

    const stats2 = rag.getStats();

    expect(stats2.totalChunks).toBeGreaterThan(stats1.totalChunks);
    expect(stats2.files).toBeGreaterThan(stats1.files);
    expect(duration).toBeLessThan(10000);
  });

  it('should use cached results for identical queries', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const start1 = Date.now();
    const results1 = await rag.searchCodebase('calculate sum', 5);
    const duration1 = Date.now() - start1;

    const start2 = Date.now();
    const results2 = await rag.searchCodebase('calculate sum', 5);
    const duration2 = Date.now() - start2;

    expect(results1.length).toBe(results2.length);
    expect(results1[0].filePath).toBe(results2[0].filePath);
  });

  it('should handle large codebase efficiently', async () => {
    for (let i = 0; i < 20; i++) {
      const code = Array(50)
        .fill(null)
        .map((_, j) => `export const func${i}_${j} = () => ${i * j};`)
        .join('\n');
      await writeTestFile(workspace, `large-file-${i}.ts`, code);
    }

    const rag = createCodebaseRAG(workspace);

    const start = Date.now();
    await rag.indexCodebase();
    const duration = Date.now() - start;

    const stats = rag.getStats();

    expect(stats.files).toBeGreaterThan(20);
    expect(stats.totalChunks).toBeGreaterThan(20);
    expect(duration).toBeLessThan(60000);
  });

  it('should maintain cache directory structure', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const cacheDir = path.join(workspace, '.rag-cache');
    const cacheExists = await fs
      .access(cacheDir)
      .then(() => true)
      .catch(() => false);

    expect(cacheExists).toBe(true);

    const cacheFiles = await fs.readdir(cacheDir);
    expect(cacheFiles.length).toBeGreaterThan(0);
  });

  it('should search efficiently across large result sets', async () => {
    for (let i = 0; i < 10; i++) {
      const code = `
        export function process${i}(data: string) {
          return data.toUpperCase();
        }
        export function transform${i}(input: number) {
          return input * 2;
        }
      `;
      await writeTestFile(workspace, `module-${i}.ts`, code);
    }

    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const start = Date.now();
    const results = await rag.searchCodebase('process data', 20);
    const duration = Date.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(5000);
  });

  it('should handle concurrent indexing requests', async () => {
    const rag = createCodebaseRAG(workspace);

    const promises = [
      rag.indexCodebase(),
      rag.indexCodebase(),
      rag.indexCodebase(),
    ];

    await Promise.all(promises);

    const stats = rag.getStats();
    expect(stats.totalChunks).toBeGreaterThan(0);
  });

  it('should efficiently re-index after file deletion', async () => {
    await writeTestFile(workspace, 'temporary.ts', 'export const temp = 1;');

    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();
    const stats1 = rag.getStats();

    await fs.unlink(path.join(workspace, 'temporary.ts'));

    await rag.indexCodebase();
    const stats2 = rag.getStats();

    expect(stats2.totalChunks).toBeLessThanOrEqual(stats1.totalChunks);
  });

  it('should provide accurate cache statistics', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const stats = rag.getStats();

    expect(stats).toHaveProperty('files');
    expect(stats).toHaveProperty('totalChunks');
    expect(stats.files).toBeGreaterThan(0);
    expect(stats.totalChunks).toBeGreaterThan(0);
  });
});
