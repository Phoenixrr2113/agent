import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSQLiteStorage } from './sqlite-storage.js';
import fs from 'fs';
import path from 'path';

describe('SQLite Storage - SQL Injection Protection', () => {
  const testDbPath = path.join(process.cwd(), 'test-sqlite-storage.db');
  let storage: ReturnType<typeof createSQLiteStorage>;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    storage = createSQLiteStorage(testDbPath);
  });

  afterEach(async () => {
    await storage.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const walPath = `${testDbPath}-wal`;
    const shmPath = `${testDbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('entities.update', () => {
    it('should allow updating valid columns', async () => {
      const entity = {
        id: 'test-entity-1',
        name: 'Test Entity',
        type: 'person',
        attributes: { age: 30 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.entities.create(entity);

      await expect(
        storage.entities.update('test-entity-1', {
          name: 'Updated Name',
          attributes: { age: 31 },
        })
      ).resolves.not.toThrow();

      const updated = await storage.entities.get('test-entity-1');
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.attributes).toEqual({ age: 31 });
    });

    it('should reject invalid column names to prevent SQL injection', async () => {
      const entity = {
        id: 'test-entity-2',
        name: 'Test Entity',
        type: 'person',
        attributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.entities.create(entity);

      await expect(
        storage.entities.update('test-entity-2', {
          name: 'Valid Update',
          invalidColumn: 'malicious value',
        } as any)
      ).rejects.toThrow('Invalid column name for entity update: invalidColumn');
    });

    it('should reject SQL injection attempts via column names', async () => {
      const entity = {
        id: 'test-entity-3',
        name: 'Test Entity',
        type: 'person',
        attributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.entities.create(entity);

      await expect(
        storage.entities.update('test-entity-3', {
          'name; DROP TABLE entities; --': 'injection attempt',
        } as any)
      ).rejects.toThrow('Invalid column name for entity update');
    });
  });

  describe('facts.update', () => {
    it('should allow updating validTo', async () => {
      const fact = {
        id: 'test-fact-1',
        content: 'Test fact',
        embedding: [0.1, 0.2, 0.3],
        entityIds: [],
        relationIds: [],
        validFrom: new Date(),
        validTo: null,
        createdAt: new Date(),
        source: 'test',
        confidence: 0.9,
      };

      await storage.facts.create(fact);

      const newValidTo = new Date();
      await expect(
        storage.facts.update('test-fact-1', { validTo: newValidTo })
      ).resolves.not.toThrow();

      const updated = await storage.facts.get('test-fact-1');
      expect(updated?.validTo?.getTime()).toBe(newValidTo.getTime());
    });

    it('should reject invalid column names for facts', async () => {
      const fact = {
        id: 'test-fact-2',
        content: 'Test fact',
        embedding: [0.1, 0.2, 0.3],
        entityIds: [],
        relationIds: [],
        validFrom: new Date(),
        validTo: null,
        createdAt: new Date(),
        source: 'test',
        confidence: 0.9,
      };

      await storage.facts.create(fact);

      await expect(
        storage.facts.update('test-fact-2', {
          validTo: new Date(),
          invalidColumn: 'malicious',
        } as any)
      ).rejects.toThrow('Invalid column name for fact update: invalidColumn');
    });
  });
});
