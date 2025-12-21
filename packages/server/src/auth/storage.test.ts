import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiKeyStorage } from './storage.js';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('API Key Storage', () => {
  const testDbPath = join(process.cwd(), '.test-auth.db');
  let storage: ReturnType<typeof createApiKeyStorage>;

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    storage = createApiKeyStorage(testDbPath);
  });

  afterEach(async () => {
    await storage.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testDbPath + '-wal')) {
      unlinkSync(testDbPath + '-wal');
    }
    if (existsSync(testDbPath + '-shm')) {
      unlinkSync(testDbPath + '-shm');
    }
  });

  describe('create', () => {
    it('should create a new API key with unique hash', async () => {
      const { key, keyHash } = await storage.create('test-key');
      
      expect(key).toMatch(/^ak_[a-f0-9]{48}$/);
      expect(keyHash).toHaveLength(64);
    });

    it('should generate different keys on each call', async () => {
      const key1 = await storage.create('key1');
      const key2 = await storage.create('key2');
      
      expect(key1.key).not.toBe(key2.key);
      expect(key1.keyHash).not.toBe(key2.keyHash);
    });
  });

  describe('validate', () => {
    it('should return keyHash for valid key', async () => {
      const { key, keyHash } = await storage.create('test-key');
      
      const result = await storage.validate(key);
      
      expect(result).toBe(keyHash);
    });

    it('should return null for invalid key', async () => {
      const result = await storage.validate('ak_invalid123');
      
      expect(result).toBeNull();
    });

    it('should update lastUsedAt on successful validation', async () => {
      const { key, keyHash } = await storage.create('test-key');
      
      const keysBefore = await storage.list();
      const keyBefore = keysBefore.find(k => k.keyHash === keyHash);
      expect(keyBefore?.lastUsedAt).toBeNull();

      await storage.validate(key);

      const keysAfter = await storage.list();
      const keyAfter = keysAfter.find(k => k.keyHash === keyHash);
      expect(keyAfter?.lastUsedAt).not.toBeNull();
    });
  });

  describe('list', () => {
    it('should return empty array when no keys exist', async () => {
      const keys = await storage.list();
      
      expect(keys).toEqual([]);
    });

    it('should return all created keys', async () => {
      await storage.create('key1');
      await storage.create('key2');
      
      const keys = await storage.list();
      
      expect(keys).toHaveLength(2);
      expect(keys.map(k => k.name)).toContain('key1');
      expect(keys.map(k => k.name)).toContain('key2');
    });
  });

  describe('revoke', () => {
    it('should remove key and return true', async () => {
      const { key, keyHash } = await storage.create('test-key');
      
      const revoked = await storage.revoke(keyHash);
      
      expect(revoked).toBe(true);
      expect(await storage.validate(key)).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const revoked = await storage.revoke('nonexistent');
      
      expect(revoked).toBe(false);
    });
  });
});
