import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createFsTool } from './fs-tool.js';

describe.skip('createFsTool', () => {
  let tempDir: string;
  let fsTool: ReturnType<typeof createFsTool>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-tool-test-'));
    fsTool = createFsTool(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true });
  });

  describe('read action', () => {
    it('should read file contents', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const result = JSON.parse(await (fsTool as any).execute({ action: 'read', path: testFile }));

      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello, World!');
    });

    it('should support pagination with offset and limit', async () => {
      const testFile = path.join(tempDir, 'lines.txt');
      await fs.writeFile(testFile, 'line1\nline2\nline3\nline4\nline5');

      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'read', 
        path: testFile,
        offset: 2,
        limit: 2 
      }));

      expect(result.success).toBe(true);
      expect(result.content).toBe('line2\nline3');
      expect(result.linesShown).toEqual([2, 4]);
    });

    it('should return error for non-existent file', async () => {
      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'read', 
        path: path.join(tempDir, 'nonexistent.txt') 
      }));

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('FILE_NOT_FOUND');
    });
  });

  describe('write action', () => {
    it('should create file with content', async () => {
      const testFile = path.join(tempDir, 'new.txt');

      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'write', 
        path: testFile,
        content: 'New content' 
      }));

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('New content');
    });

    it('should create parent directories', async () => {
      const testFile = path.join(tempDir, 'subdir', 'deep', 'file.txt');

      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'write', 
        path: testFile,
        content: 'Deep content' 
      }));

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Deep content');
    });
  });

  describe('edit action', () => {
    it('should replace text in file', async () => {
      const testFile = path.join(tempDir, 'edit.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'edit', 
        path: testFile,
        old_string: 'World',
        new_string: 'Universe' 
      }));

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Hello, Universe!');
    });

    it('should return error when old_string not found', async () => {
      const testFile = path.join(tempDir, 'edit.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'edit', 
        path: testFile,
        old_string: 'NotFound',
        new_string: 'Replacement' 
      }));

      expect(result.success).toBe(false);
    });
  });

  describe('list action', () => {
    it('should list directory contents', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(tempDir, 'subdir'));

      const result = JSON.parse(await (fsTool as any).execute({ action: 'list', path: tempDir }));

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(3);
      expect(result.entries.map((e: any) => e.name).sort()).toEqual(['file1.txt', 'file2.txt', 'subdir']);
    });

    it('should include sizes when requested', async () => {
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');

      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'list', 
        path: tempDir,
        sizes: true 
      }));

      expect(result.success).toBe(true);
      const fileEntry = result.entries.find((e: any) => e.name === 'file.txt');
      expect(fileEntry.size).toBeDefined();
      expect(fileEntry.formattedSize).toBeDefined();
    });
  });

  describe('glob action', () => {
    it('should find files matching pattern', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.ts'), '');
      await fs.writeFile(path.join(tempDir, 'file2.ts'), '');
      await fs.writeFile(path.join(tempDir, 'file3.js'), '');

      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'glob', 
        path: tempDir,
        pattern: '*.ts' 
      }));

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe('move action', () => {
    it('should move file to new location', async () => {
      const source = path.join(tempDir, 'source.txt');
      const dest = path.join(tempDir, 'dest.txt');
      await fs.writeFile(source, 'content');

      const result = JSON.parse(await (fsTool as any).execute({ 
        action: 'move', 
        path: source,
        destination: dest 
      }));

      expect(result.success).toBe(true);
      await expect(fs.access(source)).rejects.toThrow();
      const content = await fs.readFile(dest, 'utf-8');
      expect(content).toBe('content');
    });
  });

  describe('delete action', () => {
    it('should delete file', async () => {
      const testFile = path.join(tempDir, 'delete.txt');
      await fs.writeFile(testFile, 'content');

      const result = JSON.parse(await (fsTool as any).execute({ action: 'delete', path: testFile }));

      expect(result.success).toBe(true);
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    it('should delete directory recursively', async () => {
      const testDir = path.join(tempDir, 'deletedir');
      await fs.mkdir(testDir);
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content');

      const result = JSON.parse(await (fsTool as any).execute({ action: 'delete', path: testDir }));

      expect(result.success).toBe(true);
      await expect(fs.access(testDir)).rejects.toThrow();
    });
  });

  describe('mkdir action', () => {
    it('should create directory', async () => {
      const newDir = path.join(tempDir, 'newdir');

      const result = JSON.parse(await (fsTool as any).execute({ action: 'mkdir', path: newDir }));

      expect(result.success).toBe(true);
      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('info action', () => {
    it('should return file metadata', async () => {
      const testFile = path.join(tempDir, 'info.txt');
      await fs.writeFile(testFile, 'content');

      const result = JSON.parse(await (fsTool as any).execute({ action: 'info', path: testFile }));

      expect(result.success).toBe(true);
      expect(result.info.size).toBe(7);
      expect(result.info.formattedSize).toBeDefined();
    });
  });
});
