import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@agent/shared';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hash: string;
}

export interface Cache<T> {
  get: (key: string) => Promise<T | null>;
  set: (key: string, value: T, contentHash?: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  isValid: (key: string, contentHash: string) => Promise<boolean>;
}

export function createFileCache<T>(cacheDir: string): Cache<T> {
  const ensureCacheDir = async () => {
    try {
      await fs.mkdir(cacheDir, { recursive: true });
    } catch (error) {
      logger.debug('Failed to create cache directory', { cacheDir, error });
    }
  };

  const getCachePath = (key: string): string => {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(cacheDir, `${hash}.json`);
  };

  return {
    get: async (key: string): Promise<T | null> => {
      try {
        const cachePath = getCachePath(key);
        const content = await fs.readFile(cachePath, 'utf-8');
        const entry: CacheEntry<T> = JSON.parse(content);
        return entry.data;
      } catch (error) {
        logger.debug('Cache miss or read error', { key, error });
        return null;
      }
    },

    set: async (key: string, value: T, contentHash?: string): Promise<void> => {
      await ensureCacheDir();
      const cachePath = getCachePath(key);
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        hash: contentHash || '',
      };
      await fs.writeFile(cachePath, JSON.stringify(entry), 'utf-8');
    },

    has: async (key: string): Promise<boolean> => {
      try {
        const cachePath = getCachePath(key);
        await fs.access(cachePath);
        return true;
      } catch {
        return false;
      }
    },

    delete: async (key: string): Promise<void> => {
      try {
        const cachePath = getCachePath(key);
        await fs.unlink(cachePath);
      } catch (error) {
        logger.debug('Failed to delete cache entry', { key, error });
      }
    },

    clear: async (): Promise<void> => {
      try {
        const files = await fs.readdir(cacheDir);
        await Promise.all(
          files.map(file => fs.unlink(path.join(cacheDir, file)))
        );
      } catch (error) {
        logger.debug('Failed to clear cache', { cacheDir, error });
      }
    },

    isValid: async (key: string, contentHash: string): Promise<boolean> => {
      try {
        const cachePath = getCachePath(key);
        const content = await fs.readFile(cachePath, 'utf-8');
        const entry: CacheEntry<T> = JSON.parse(content);
        return entry.hash === contentHash;
      } catch {
        return false;
      }
    },
  };
}

export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
