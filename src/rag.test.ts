import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCodebaseRAG, type CodebaseRAG } from './rag.js';
import fs from 'fs/promises';
import { embedMany } from 'ai';

vi.mock('ai');

vi.mock('@ai-sdk/google', () => ({
  google: {
    textEmbedding: vi.fn(() => 'mock-model'),
  },
}));

vi.mock('fs/promises');

describe('createCodebaseRAG', () => {
  let rag: CodebaseRAG;

  beforeEach(() => {
    vi.clearAllMocks();
    rag = createCodebaseRAG('/test/workspace', { enableCache: false, chunkingStrategy: 'fixed' });
  });

  describe('indexCodebase', () => {
    it('should handle empty workspace', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);

      await rag.indexCodebase();

      const stats = rag.getStats();
      expect(stats.totalChunks).toBe(0);
      expect(stats.files).toBe(0);
    });

    it('should index TypeScript files', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValue([
        { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
      ]);

      mockReadFile.mockResolvedValue('function test() {\n  return 42;\n}');

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      await rag.indexCodebase();

      expect(vi.mocked(embedMany)).toHaveBeenCalled();
      const stats = rag.getStats();
      expect(stats.totalChunks).toBeGreaterThan(0);
    });

    it('should skip node_modules and dist directories', async () => {
      const mockReaddir = vi.mocked(fs.readdir);

      mockReaddir.mockImplementation(async (path: any) => {
        if (path === '/test/workspace') {
          return [
            { name: 'node_modules', isFile: () => false, isDirectory: () => true } as any,
            { name: 'dist', isFile: () => false, isDirectory: () => true } as any,
            { name: 'src', isFile: () => false, isDirectory: () => true } as any,
          ];
        }
        return [];
      });

      await rag.indexCodebase();

      const calls = mockReaddir.mock.calls;
      const paths = calls.map(c => c[0]);

      expect(paths).not.toContain('/test/workspace/node_modules');
      expect(paths).not.toContain('/test/workspace/dist');
    });

    it('should index multiple file types', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValue([
        { name: 'index.ts', isFile: () => true, isDirectory: () => false } as any,
        { name: 'main.js', isFile: () => true, isDirectory: () => false } as any,
        { name: 'script.py', isFile: () => true, isDirectory: () => false } as any,
        { name: 'readme.md', isFile: () => true, isDirectory: () => false } as any,
      ]);

      mockReadFile.mockResolvedValue('code content');

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [[0.1], [0.2], [0.3]],
      });

      await rag.indexCodebase();

      expect(mockReadFile).toHaveBeenCalledTimes(3);
    });
  });

  describe('searchCodebase', () => {
    beforeEach(async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValue([
        { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
      ]);

      mockReadFile.mockResolvedValue('function test() { return 42; }');

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [[0.5, 0.5, 0.5]],
      });

      await rag.indexCodebase();
    });

    it('should return empty array when no embeddings exist', async () => {
      const emptyRag = createCodebaseRAG('/empty', { enableCache: false });
      const results = await emptyRag.searchCodebase('test query');

      expect(results).toEqual([]);
    });

    it('should search and return relevant chunks', async () => {
      vi.mocked(embedMany).mockResolvedValueOnce({
        embeddings: [[0.5, 0.5, 0.5]],
      });

      const results = await rag.searchCodebase('test function', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('filePath');
    });

    it('should respect topK parameter', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockReadFile = vi.mocked(fs.readFile);

      const longCode = Array(300).fill('const x = 1;').join('\n');

      mockReaddir.mockResolvedValue([
        { name: 'large.ts', isFile: () => true, isDirectory: () => false } as any,
      ]);

      mockReadFile.mockResolvedValue(longCode);

      const embeddings = Array(3).fill([0.5, 0.5, 0.5]);
      vi.mocked(embedMany).mockResolvedValue({ embeddings });

      const newRag = createCodebaseRAG('/test2', { enableCache: false, chunkingStrategy: 'fixed' });
      await newRag.indexCodebase();

      vi.mocked(embedMany).mockResolvedValueOnce({
        embeddings: [[0.5, 0.5, 0.5]],
      });

      const results = await newRag.searchCodebase('test', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by similarity threshold', async () => {
      vi.mocked(embedMany).mockResolvedValueOnce({
        embeddings: [[0.0, 0.0, 0.0]],
      });

      const results = await rag.searchCodebase('completely different query', 5, 0.9);

      expect(results.length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValue([
        { name: 'file1.ts', isFile: () => true, isDirectory: () => false } as any,
        { name: 'file2.ts', isFile: () => true, isDirectory: () => false } as any,
      ]);

      mockReadFile.mockResolvedValue('const x = 1;');

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [[0.1], [0.2]],
      });

      await rag.indexCodebase();

      const stats = rag.getStats();

      expect(stats.totalChunks).toBe(2);
      expect(stats.files).toBe(2);
    });

    it('should return zero stats for unindexed codebase', () => {
      const newRag = createCodebaseRAG('/test', { enableCache: false });
      const stats = newRag.getStats();

      expect(stats.totalChunks).toBe(0);
      expect(stats.files).toBe(0);
    });
  });

  describe('chunking', () => {
    it('should chunk large files appropriately', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockReadFile = vi.mocked(fs.readFile);

      const largeFile = Array(250).fill('const x = 1;').join('\n');

      mockReaddir.mockResolvedValue([
        { name: 'large.ts', isFile: () => true, isDirectory: () => false } as any,
      ]);

      mockReadFile.mockResolvedValue(largeFile);

      vi.mocked(embedMany).mockResolvedValue({
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
          [0.5, 0.6],
        ],
      });

      await rag.indexCodebase();

      const stats = rag.getStats();
      expect(stats.totalChunks).toBeGreaterThan(1);
    });
  });
});
