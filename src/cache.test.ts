import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFileCache, computeHash } from './core/rag/cache.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('cache', () => {
  const testCacheDir = path.join(__dirname, '../tests/temp/cache-test');

  beforeEach(async () => {
    await fs.mkdir(testCacheDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch (error) {
    }
  });

  describe('createFileCache', () => {
    it('should store and retrieve data', async () => {
      const cache = createFileCache<string>(testCacheDir);

      await cache.set('key1', 'value1');
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const cache = createFileCache<string>(testCacheDir);

      const result = await cache.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      const cache = createFileCache<string>(testCacheDir);

      await cache.set('key1', 'value1');

      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('key2')).toBe(false);
    });

    it('should delete cached entries', async () => {
      const cache = createFileCache<string>(testCacheDir);

      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);

      await cache.delete('key1');
      expect(await cache.has('key1')).toBe(false);
    });

    it('should clear all cache entries', async () => {
      const cache = createFileCache<string>(testCacheDir);

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('key2')).toBe(true);

      await cache.clear();

      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(false);
    });

    it('should validate cache entries by hash', async () => {
      const cache = createFileCache<string>(testCacheDir);
      const hash1 = 'abc123';
      const hash2 = 'def456';

      await cache.set('key1', 'value1', hash1);

      expect(await cache.isValid('key1', hash1)).toBe(true);
      expect(await cache.isValid('key1', hash2)).toBe(false);
    });

    it('should handle complex objects', async () => {
      interface TestData {
        name: string;
        items: number[];
        nested: { value: string };
      }

      const cache = createFileCache<TestData>(testCacheDir);
      const data: TestData = {
        name: 'test',
        items: [1, 2, 3],
        nested: { value: 'nested data' },
      };

      await cache.set('complex', data);
      const result = await cache.get('complex');

      expect(result).toEqual(data);
    });

    it('should handle concurrent operations', async () => {
      const cache = createFileCache<string>(testCacheDir);

      await Promise.all([
        cache.set('key1', 'value1'),
        cache.set('key2', 'value2'),
        cache.set('key3', 'value3'),
      ]);

      const results = await Promise.all([
        cache.get('key1'),
        cache.get('key2'),
        cache.get('key3'),
      ]);

      expect(results).toEqual(['value1', 'value2', 'value3']);
    });
  });

  describe('computeHash', () => {
    it('should compute consistent hashes', () => {
      const content = 'test content';
      const hash1 = computeHash(content);
      const hash2 = computeHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = computeHash('content1');
      const hash2 = computeHash('content2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce hex string hashes', () => {
      const hash = computeHash('test');

      expect(hash).toMatch(/^[a-f0-9]+$/);
      expect(hash.length).toBe(64);
    });
  });
});
