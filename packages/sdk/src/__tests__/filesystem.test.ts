/**
 * @fileoverview Tests for filesystem tools.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  createFilesystemTools,
  setAllowedDirectories,
  setAllowedDirectoriesAsync,
  validatePath,
  validateNewPath,
  expandHome,
  formatSize,
} from '../tools/filesystem';

describe('Filesystem Tools', () => {
  let tempDir: string;
  let tools: ReturnType<typeof createFilesystemTools>;

  // Helper to safely execute tool
  const execute = <T extends { execute?: (args: unknown, options: unknown) => Promise<string> }>(
    tool: T,
    args: unknown
  ) => {
    if (!tool.execute) throw new Error('Tool execute not defined');
    return tool.execute(args, { toolCallId: 'test', messages: [] });
  };

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-test-'));
    // Set allowed directories BEFORE creating tools - use async to resolve symlinks
    await setAllowedDirectoriesAsync([tempDir]);
    tools = createFilesystemTools({ workspaceRoot: tempDir });
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    // Reset allowed directories to empty to ensure test isolation
    setAllowedDirectories([]);
  });

  describe('Path Security', () => {
    it('should expand home directory', () => {
      const result = expandHome('~/test');
      expect(result).toBe(path.join(os.homedir(), 'test'));
    });

    it('should validate paths within allowed directories', async () => {
      await setAllowedDirectoriesAsync([tempDir]);
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test');
      
      const result = await validatePath(testFile);
      const expectedRealPath = await fs.realpath(testFile);
      expect(result).toBe(expectedRealPath);
    });

    it('should reject paths outside allowed directories', async () => {
      setAllowedDirectories([tempDir]);
      
      await expect(validatePath('/etc/passwd')).rejects.toThrow('Access denied');
    });

    it('should validate new paths', async () => {
      setAllowedDirectories([tempDir]);
      const newPath = path.join(tempDir, 'new-file.txt');
      
      const result = await validateNewPath(newPath);
      expect(result).toBe(newPath);
    });
  });

  describe('formatSize', () => {
    it('should format bytes', () => {
      expect(formatSize(500)).toBe('500.00 B');
    });

    it('should format kilobytes', () => {
      expect(formatSize(1024)).toBe('1.00 KB');
    });

    it('should format megabytes', () => {
      expect(formatSize(1024 * 1024)).toBe('1.00 MB');
    });
  });

  describe('read_text_file tool', () => {
    it('should read file contents', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const result = await execute(tools.read_text_file, 
        { path: testFile },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.lines).toBe(1);
    });

    it('should support head parameter', async () => {
      const testFile = path.join(tempDir, 'multiline.txt');
      await fs.writeFile(testFile, 'line1\nline2\nline3\nline4\nline5');

      const result = await execute(tools.read_text_file, 
        { path: testFile, head: 2 },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.lines).toBe(2);
    });

    it('should handle non-existent files', async () => {
      const result = await execute(tools.read_text_file, 
        { path: path.join(tempDir, 'nonexistent.txt') },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('write_file tool', () => {
    it('should write file contents', async () => {
      const testFile = path.join(tempDir, 'output.txt');

      const result = await execute(tools.write_file, 
        { path: testFile, content: 'Test content' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Test content');
    });

    it('should create parent directories', async () => {
      const testFile = path.join(tempDir, 'nested', 'dir', 'file.txt');

      const result = await execute(tools.write_file, 
        { path: testFile, content: 'Nested content' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);

      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('list_directory tool', () => {
    it('should list directory contents', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'a');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'b');
      await fs.mkdir(path.join(tempDir, 'subdir'));

      const result = await execute(tools.list_directory, 
        { path: tempDir },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      if (!parsed.success) {
        console.log('list_directory failed:', parsed.error);
      }
      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(3);
      expect(parsed.entries.some((e: { name: string }) => e.name === 'subdir')).toBe(true);
    });
  });

  describe('create_directory tool', () => {
    it('should create directory', async () => {
      const newDir = path.join(tempDir, 'new-directory');

      const result = await execute(tools.create_directory, 
        { path: newDir },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);

      const stat = await fs.stat(newDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('get_file_info tool', () => {
    it('should return file info', async () => {
      const testFile = path.join(tempDir, 'info.txt');
      await fs.writeFile(testFile, 'content');

      const result = await execute(tools.get_file_info, 
        { path: testFile },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.size).toBe(7);
      expect(parsed.isDirectory).toBe(false);
    });
  });
});
