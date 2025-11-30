import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@agent/shared';
export function createFileCache(cacheDir) {
    const ensureCacheDir = async () => {
        try {
            await fs.mkdir(cacheDir, { recursive: true });
        }
        catch (error) {
            logger.debug('Failed to create cache directory', { cacheDir, error });
        }
    };
    const getCachePath = (key) => {
        const hash = crypto.createHash('md5').update(key).digest('hex');
        return path.join(cacheDir, `${hash}.json`);
    };
    return {
        get: async (key) => {
            try {
                const cachePath = getCachePath(key);
                const content = await fs.readFile(cachePath, 'utf-8');
                const entry = JSON.parse(content);
                return entry.data;
            }
            catch (error) {
                logger.debug('Cache miss or read error', { key, error });
                return null;
            }
        },
        set: async (key, value, contentHash) => {
            await ensureCacheDir();
            const cachePath = getCachePath(key);
            const entry = {
                data: value,
                timestamp: Date.now(),
                hash: contentHash || '',
            };
            await fs.writeFile(cachePath, JSON.stringify(entry), 'utf-8');
        },
        has: async (key) => {
            try {
                const cachePath = getCachePath(key);
                await fs.access(cachePath);
                return true;
            }
            catch {
                return false;
            }
        },
        delete: async (key) => {
            try {
                const cachePath = getCachePath(key);
                await fs.unlink(cachePath);
            }
            catch (error) {
                logger.debug('Failed to delete cache entry', { key, error });
            }
        },
        clear: async () => {
            try {
                const files = await fs.readdir(cacheDir);
                await Promise.all(files.map(file => fs.unlink(path.join(cacheDir, file))));
            }
            catch (error) {
                logger.debug('Failed to clear cache', { cacheDir, error });
            }
        },
        isValid: async (key, contentHash) => {
            try {
                const cachePath = getCachePath(key);
                const content = await fs.readFile(cachePath, 'utf-8');
                const entry = JSON.parse(content);
                return entry.hash === contentHash;
            }
            catch {
                return false;
            }
        },
    };
}
export function computeHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}
