import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createFilesystemTools, setAllowedDirectories, getAllowedDirectories } from './filesystem.js';

describe('Filesystem Tools', () => {
  let testDir: string;
  let filesystemTools: ReturnType<typeof createFilesystemTools>;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `fs-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    filesystemTools = createFilesystemTools(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('setAllowedDirectories', () => {
    it('should set and get allowed directories', () => {
      const dirs = [testDir];
      setAllowedDirectories(dirs);
      const result = getAllowedDirectories();
      expect(result).toEqual([path.resolve(testDir)]);
    });
  });

  describe('read_text_file', () => {
    it('should read file contents', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');

      const result = await filesystemTools.read_text_file.execute({ path: filePath });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.content).toBe('Hello World');
    });

    it('should read first N lines with head parameter', async () => {
      const filePath = path.join(testDir, 'multiline.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3\nLine 4', 'utf-8');

      const result = await filesystemTools.read_text_file.execute({ path: filePath, head: 2 });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.content).toBe('Line 1\nLine 2');
    });

    it('should read last N lines with tail parameter', async () => {
      const filePath = path.join(testDir, 'multiline.txt');
      await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3\nLine 4', 'utf-8');

      const result = await filesystemTools.read_text_file.execute({ path: filePath, tail: 2 });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.content).toContain('Line 3');
      expect(parsed.content).toContain('Line 4');
    });

    it('should reject both head and tail parameters', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'content', 'utf-8');

      const result = await filesystemTools.read_text_file.execute({ path: filePath, head: 1, tail: 1 });
      const parsed = JSON.parse(result as string);

      expect(parsed.error).toBe('Cannot specify both head and tail parameters');
    });

    it('should return error for non-existent file', async () => {
      const result = await filesystemTools.read_text_file.execute({ path: '/nonexistent.txt' });
      const parsed = JSON.parse(result as string);

      expect(parsed.error).toBeDefined();
    });
  });

  describe('write_file', () => {
    it('should create new file', async () => {
      const filePath = path.join(testDir, 'new.txt');
      const result = await filesystemTools.write_file.execute({ path: filePath, content: 'New content' });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('New content');
    });

    it('should overwrite existing file', async () => {
      const filePath = path.join(testDir, 'existing.txt');
      await fs.writeFile(filePath, 'Old content', 'utf-8');

      const result = await filesystemTools.write_file.execute({ path: filePath, content: 'New content' });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('New content');
    });
  });

  describe('edit_file', () => {
    it('should edit file content', async () => {
      const filePath = path.join(testDir, 'edit.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');

      const result = await filesystemTools.edit_file.execute({
        path: filePath,
        edits: [{ oldText: 'World', newText: 'Universe' }],
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Hello Universe');
    });

    it('should support dry run', async () => {
      const filePath = path.join(testDir, 'dryrun.txt');
      const originalContent = 'Original content';
      await fs.writeFile(filePath, originalContent, 'utf-8');

      const result = await filesystemTools.edit_file.execute({
        path: filePath,
        edits: [{ oldText: 'Original', newText: 'Modified' }],
        dryRun: true,
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.dryRun).toBe(true);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe(originalContent);
    });

    it('should return error if text not found', async () => {
      const filePath = path.join(testDir, 'edit.txt');
      await fs.writeFile(filePath, 'Hello World', 'utf-8');

      const result = await filesystemTools.edit_file.execute({
        path: filePath,
        edits: [{ oldText: 'NonExistent', newText: 'New' }],
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.error).toContain('Could not find text to replace');
    });
  });

  describe('read_multiple_files', () => {
    it('should read multiple files', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      await fs.writeFile(file1, 'Content 1', 'utf-8');
      await fs.writeFile(file2, 'Content 2', 'utf-8');

      const result = await filesystemTools.read_multiple_files.execute({ paths: [file1, file2] });
      const parsed = JSON.parse(result as string);

      expect(parsed.results).toHaveLength(2);
      expect(parsed.results[0].success).toBe(true);
      expect(parsed.results[0].content).toBe('Content 1');
      expect(parsed.results[1].success).toBe(true);
      expect(parsed.results[1].content).toBe('Content 2');
    });

    it('should handle mixed success and failure', async () => {
      const file1 = path.join(testDir, 'exists.txt');
      const file2 = path.join(testDir, 'nonexistent.txt');
      await fs.writeFile(file1, 'Content', 'utf-8');

      const result = await filesystemTools.read_multiple_files.execute({ paths: [file1, file2] });
      const parsed = JSON.parse(result as string);

      expect(parsed.results).toHaveLength(2);
      expect(parsed.results[0].success).toBe(true);
      expect(parsed.results[1].success).toBe(false);
      expect(parsed.results[1].error).toBeDefined();
    });
  });

  describe('create_directory', () => {
    it('should create directory', async () => {
      const dirPath = path.join(testDir, 'newdir');
      const result = await filesystemTools.create_directory.execute({ path: dirPath });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories', async () => {
      const dirPath = path.join(testDir, 'level1', 'level2', 'level3');
      const result = await filesystemTools.create_directory.execute({ path: dirPath });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should be idempotent', async () => {
      const dirPath = path.join(testDir, 'idempotent');
      await fs.mkdir(dirPath);

      const result = await filesystemTools.create_directory.execute({ path: dirPath });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
    });
  });

  describe('list_directory', () => {
    it('should list directory contents', async () => {
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content', 'utf-8');
      await fs.mkdir(path.join(testDir, 'subdir'));

      const result = await filesystemTools.list_directory.execute({ path: testDir });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.entries).toHaveLength(2);

      const fileEntry = parsed.entries.find((e: any) => e.name === 'file.txt');
      const dirEntry = parsed.entries.find((e: any) => e.name === 'subdir');

      expect(fileEntry?.type).toBe('file');
      expect(fileEntry?.prefix).toBe('[FILE]');
      expect(dirEntry?.type).toBe('directory');
      expect(dirEntry?.prefix).toBe('[DIR]');
    });
  });

  describe('list_directory_with_sizes', () => {
    it('should list with sizes', async () => {
      await fs.writeFile(path.join(testDir, 'small.txt'), 'x', 'utf-8');
      await fs.writeFile(path.join(testDir, 'large.txt'), 'x'.repeat(1000), 'utf-8');

      const result = await filesystemTools.list_directory_with_sizes.execute({ path: testDir });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.entries.every((e: any) => typeof e.size === 'number')).toBe(true);
      expect(parsed.entries.every((e: any) => typeof e.formattedSize === 'string')).toBe(true);
    });

    it('should sort by size', async () => {
      await fs.writeFile(path.join(testDir, 'small.txt'), 'x', 'utf-8');
      await fs.writeFile(path.join(testDir, 'large.txt'), 'x'.repeat(1000), 'utf-8');

      const result = await filesystemTools.list_directory_with_sizes.execute({
        path: testDir,
        sortBy: 'size'
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.entries[0].size).toBeGreaterThan(parsed.entries[1].size);
    });
  });

  describe('directory_tree', () => {
    it('should build directory tree', async () => {
      await fs.mkdir(path.join(testDir, 'subdir'));
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content', 'utf-8');
      await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'content', 'utf-8');

      const result = await filesystemTools.directory_tree.execute({ path: testDir });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.tree.type).toBe('directory');
      expect(parsed.tree.children).toBeDefined();
      expect(parsed.tree.children.length).toBeGreaterThan(0);
    });

    it('should exclude patterns', async () => {
      await fs.writeFile(path.join(testDir, 'include.txt'), 'content', 'utf-8');
      await fs.writeFile(path.join(testDir, 'exclude.log'), 'content', 'utf-8');

      const result = await filesystemTools.directory_tree.execute({
        path: testDir,
        excludePatterns: ['*.log']
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      const hasLog = parsed.tree.children.some((c: any) => c.name === 'exclude.log');
      expect(hasLog).toBe(false);
    });
  });

  describe('search_files', () => {
    it('should search files with glob pattern', async () => {
      await fs.writeFile(path.join(testDir, 'test1.txt'), 'content', 'utf-8');
      await fs.writeFile(path.join(testDir, 'test2.txt'), 'content', 'utf-8');
      await fs.writeFile(path.join(testDir, 'other.log'), 'content', 'utf-8');

      const result = await filesystemTools.search_files.execute({
        path: testDir,
        pattern: '*.txt'
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(2);
    });

    it('should exclude patterns', async () => {
      await fs.writeFile(path.join(testDir, 'include.txt'), 'content', 'utf-8');
      await fs.writeFile(path.join(testDir, 'exclude.txt'), 'content', 'utf-8');

      const result = await filesystemTools.search_files.execute({
        path: testDir,
        pattern: '*.txt',
        excludePatterns: ['exclude.txt']
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(1);
      expect(parsed.results[0].path).toContain('include.txt');
    });
  });

  describe('get_file_info', () => {
    it('should return file metadata', async () => {
      const filePath = path.join(testDir, 'info.txt');
      await fs.writeFile(filePath, 'test content', 'utf-8');

      const result = await filesystemTools.get_file_info.execute({ path: filePath });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);
      expect(parsed.info.size).toBeGreaterThan(0);
      expect(parsed.info.isFile).toBe(true);
      expect(parsed.info.isDirectory).toBe(false);
      expect(parsed.info.permissions).toBeDefined();
      expect(parsed.info.formattedSize).toBeDefined();
    });
  });

  describe('move_file', () => {
    it('should move file', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const destPath = path.join(testDir, 'dest.txt');
      await fs.writeFile(sourcePath, 'content', 'utf-8');

      const result = await filesystemTools.move_file.execute({
        source: sourcePath,
        destination: destPath
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.success).toBe(true);

      try {
        await fs.access(sourcePath);
        expect.fail('Source file should not exist');
      } catch {}

      const content = await fs.readFile(destPath, 'utf-8');
      expect(content).toBe('content');
    });

    it('should fail if destination exists', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const destPath = path.join(testDir, 'dest.txt');
      await fs.writeFile(sourcePath, 'source', 'utf-8');
      await fs.writeFile(destPath, 'dest', 'utf-8');

      const result = await filesystemTools.move_file.execute({
        source: sourcePath,
        destination: destPath
      });
      const parsed = JSON.parse(result as string);

      expect(parsed.error).toContain('already exists');
    });
  });

  describe('security', () => {
    it('should prevent access outside allowed directories', async () => {
      const outsidePath = path.join(os.tmpdir(), 'outside.txt');
      await fs.writeFile(outsidePath, 'content', 'utf-8');

      try {
        const result = await filesystemTools.read_text_file.execute({ path: outsidePath });
        const parsed = JSON.parse(result as string);

        expect(parsed.error).toContain('Access denied');
      } finally {
        await fs.unlink(outsidePath);
      }
    });
  });
});
