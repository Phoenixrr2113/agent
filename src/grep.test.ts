import { describe, it, expect, vi, beforeEach } from 'vitest';
import { grepWorkspace } from './core/search/grep.js';
import fs from 'fs/promises';

vi.mock('fs/promises');

describe('grepWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find exact matches in files', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockResolvedValue([
      { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
    ]);

    mockReadFile.mockResolvedValue('const foo = 42;\nconst bar = 100;');

    const results = await grepWorkspace('foo', '/workspace');

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('foo');
    expect(results[0].line).toBe(1);
  });

  it('should handle regex patterns', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockResolvedValue([
      { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
    ]);

    mockReadFile.mockResolvedValue('function test1() {}\nfunction test2() {}');

    const results = await grepWorkspace('function\\s+test\\d', '/workspace');

    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by file pattern', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockResolvedValue([
      { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
      { name: 'test.js', isFile: () => true, isDirectory: () => false } as any,
    ]);

    mockReadFile.mockResolvedValue('const test = 1;');

    const results = await grepWorkspace('test', '/workspace', { filePattern: '\\.ts$' });

    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('should ignore case when specified', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockResolvedValue([
      { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
    ]);

    mockReadFile.mockResolvedValue('const FOO = 42;');

    const results = await grepWorkspace('foo', '/workspace', { ignoreCase: true });

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('FOO');
  });

  it('should respect maxResults limit', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockResolvedValue([
      { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
    ]);

    const manyMatches = Array(50).fill('test').join('\n');
    mockReadFile.mockResolvedValue(manyMatches);

    const results = await grepWorkspace('test', '/workspace', { maxResults: 10 });

    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('should skip node_modules and dist directories', async () => {
    const mockReaddir = vi.mocked(fs.readdir);

    mockReaddir.mockImplementation(async (path: any) => {
      if (path === '/workspace') {
        return [
          { name: 'node_modules', isFile: () => false, isDirectory: () => true } as any,
          { name: 'dist', isFile: () => false, isDirectory: () => true } as any,
          { name: 'src', isFile: () => false, isDirectory: () => true } as any,
        ];
      }
      return [];
    });

    await grepWorkspace('test', '/workspace');

    const calls = mockReaddir.mock.calls;
    const paths = calls.map(c => c[0]);

    expect(paths).not.toContain('/workspace/node_modules');
    expect(paths).not.toContain('/workspace/dist');
  });

  it('should handle empty workspace', async () => {
    const mockReaddir = vi.mocked(fs.readdir);

    mockReaddir.mockResolvedValue([]);

    const results = await grepWorkspace('test', '/workspace');

    expect(results).toEqual([]);
  });

  it('should handle file read errors gracefully', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockResolvedValue([
      { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
    ]);

    mockReadFile.mockRejectedValue(new Error('Permission denied'));

    const results = await grepWorkspace('test', '/workspace');

    expect(results).toEqual([]);
  });

  it('should return correct line numbers', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockResolvedValue([
      { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
    ]);

    mockReadFile.mockResolvedValue('line1\nline2 test\nline3\nline4 test');

    const results = await grepWorkspace('test', '/workspace');

    expect(results).toHaveLength(2);
    expect(results[0].line).toBe(2);
    expect(results[1].line).toBe(4);
  });

  it('should search in nested directories', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockImplementation(async (path: any) => {
      if (path === '/workspace') {
        return [
          { name: 'src', isFile: () => false, isDirectory: () => true } as any,
        ];
      } else if (path === '/workspace/src') {
        return [
          { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
        ];
      }
      return [];
    });

    mockReadFile.mockResolvedValue('const test = 1;');

    const results = await grepWorkspace('test', '/workspace');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toContain('/workspace/src/test.ts');
  });

  it('should handle multiple matches on same line', async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockReadFile = vi.mocked(fs.readFile);

    mockReaddir.mockResolvedValue([
      { name: 'test.ts', isFile: () => true, isDirectory: () => false } as any,
    ]);

    mockReadFile.mockResolvedValue('test test test');

    const results = await grepWorkspace('test', '/workspace');

    expect(results).toHaveLength(1);
  });
});
