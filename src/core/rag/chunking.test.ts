import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chunkFile, chunkDirectory } from './chunking.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('chunking', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-chunking-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('chunkFile', () => {
    it('should chunk a TypeScript file into functions and classes', async () => {
      const content = `function hello() {
  console.log('hello');
}

class Greeter {
  greet(name: string) {
    return 'Hello, ' + name;
  }
}

const arrow = () => 'arrow';
`;
      const chunks = await chunkFile(content, 'test.ts', '.ts');

      expect(chunks.length).toBeGreaterThan(0);
      const chunkNames = chunks.map((c) => c.metadata.name).filter(Boolean);
      expect(chunkNames).toContain('hello');
      expect(chunkNames).toContain('Greeter');
    });

    it('should include file path in chunk metadata', async () => {
      const content = 'function test() {}';
      const chunks = await chunkFile(content, '/path/to/example.ts', '.ts');

      expect(chunks[0].filePath).toBe('/path/to/example.ts');
    });

    it('should handle Python files', async () => {
      const content = `def greet(name):
    return f"Hello, {name}"

class Calculator:
    def add(self, a, b):
        return a + b
`;
      const chunks = await chunkFile(content, 'test.py', '.py');

      expect(chunks.length).toBeGreaterThan(0);
      const chunkNames = chunks.map((c) => c.metadata.name).filter(Boolean);
      expect(chunkNames).toContain('greet');
      expect(chunkNames).toContain('Calculator');
    });

    it('should use fallback chunking for unsupported files', async () => {
      const content = 'This is a readme file with some content.';
      const chunks = await chunkFile(content, 'readme.md', '.md');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('readme');
    });
  });

  describe('chunkDirectory', () => {
    it('should recursively chunk all code files', async () => {
      await fs.mkdir(path.join(testDir, 'src'));
      await fs.writeFile(path.join(testDir, 'src', 'a.ts'), 'function a() {}');
      await fs.writeFile(path.join(testDir, 'src', 'b.ts'), 'function b() {}');
      await fs.writeFile(path.join(testDir, 'c.ts'), 'function c() {}');

      const chunks = await chunkDirectory(testDir);

      expect(chunks.length).toBeGreaterThanOrEqual(3);
      const names = chunks.map((c) => c.metadata.name).filter(Boolean);
      expect(names).toContain('a');
      expect(names).toContain('b');
      expect(names).toContain('c');
    });

    it('should skip node_modules and hidden directories', async () => {
      await fs.mkdir(path.join(testDir, 'node_modules'));
      await fs.mkdir(path.join(testDir, '.git'));
      await fs.writeFile(path.join(testDir, 'node_modules', 'lib.ts'), 'function lib() {}');
      await fs.writeFile(path.join(testDir, '.git', 'config.ts'), 'function config() {}');
      await fs.writeFile(path.join(testDir, 'main.ts'), 'function main() {}');

      const chunks = await chunkDirectory(testDir);

      const filePaths = chunks.map((c) => c.filePath);
      expect(filePaths.every((p) => !p.includes('node_modules'))).toBe(true);
      expect(filePaths.every((p) => !p.includes('.git'))).toBe(true);
      expect(filePaths.some((p) => p.includes('main.ts'))).toBe(true);
    });

    it('should return empty array for empty directory', async () => {
      const emptyDir = path.join(testDir, 'empty');
      await fs.mkdir(emptyDir);

      const chunks = await chunkDirectory(emptyDir);

      expect(chunks).toEqual([]);
    });
  });
});

