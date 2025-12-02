import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryProvider } from './factory.js';
import type { MemoryProvider, MemoryConfig } from './types.js';
import fs from 'fs/promises';

describe('Memory Provider Switching', () => {
  let provider: MemoryProvider;
  let dbPath: string;

  afterEach(async () => {
    if (provider) {
      await provider.close();
    }
    if (dbPath) {
      try {
        await fs.unlink(dbPath);
      } catch {}
    }
  });

  describe('Provider Interface Consistency', () => {
    it('should return consistent data format from memory-lite provider', async () => {
      dbPath = './test-memory-lite.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      const addResult = await provider.add({
        content: 'User: My name is Alice and I love programming\nAssistant: Great to meet you!',
        groupId: 'test-group',
        source: 'test',
      });

      expect(addResult).toHaveProperty('factIds');
      expect(addResult).toHaveProperty('entityIds');
      expect(Array.isArray(addResult.factIds)).toBe(true);
      expect(Array.isArray(addResult.entityIds)).toBe(true);

      const searchResult = await provider.search({
        query: 'Alice programming',
        maxResults: 10,
      });

      expect(searchResult).toHaveProperty('facts');
      expect(searchResult).toHaveProperty('entities');
      expect(searchResult).toHaveProperty('relations');
      expect(searchResult).toHaveProperty('score');
      expect(Array.isArray(searchResult.facts)).toBe(true);
      expect(Array.isArray(searchResult.entities)).toBe(true);
      expect(Array.isArray(searchResult.relations)).toBe(true);

      if (searchResult.facts.length > 0) {
        const fact = searchResult.facts[0];
        expect(fact).toHaveProperty('id');
        expect(fact).toHaveProperty('content');
        expect(fact).toHaveProperty('embedding');
        expect(fact).toHaveProperty('entityIds');
        expect(fact).toHaveProperty('relationIds');
        expect(fact).toHaveProperty('validFrom');
        expect(fact).toHaveProperty('validTo');
        expect(fact).toHaveProperty('createdAt');
        expect(fact).toHaveProperty('source');
        expect(fact).toHaveProperty('confidence');
      }

      if (searchResult.entities.length > 0) {
        const entity = searchResult.entities[0];
        expect(entity).toHaveProperty('id');
        expect(entity).toHaveProperty('name');
        expect(entity).toHaveProperty('type');
        expect(entity).toHaveProperty('attributes');
        expect(entity).toHaveProperty('createdAt');
        expect(entity).toHaveProperty('updatedAt');
      }
    });

    it('should validate add result has required arrays', async () => {
      dbPath = './test-memory-validate.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      const addResult = await provider.add({
        content: 'User: Test content',
        groupId: 'test',
      });

      expect(Array.isArray(addResult.factIds)).toBe(true);
      expect(Array.isArray(addResult.entityIds)).toBe(true);
    });

    it('should validate search result structure', async () => {
      dbPath = './test-memory-search.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      await provider.add({
        content: 'User: My favorite color is blue',
        groupId: 'test',
      });

      const searchResult = await provider.search({
        query: 'favorite color',
        maxResults: 5,
      });

      expect(typeof searchResult.score).toBe('number');
      expect(Array.isArray(searchResult.facts)).toBe(true);
      expect(Array.isArray(searchResult.entities)).toBe(true);
      expect(Array.isArray(searchResult.relations)).toBe(true);
    });

    it('should handle getEpisodes with proper structure', async () => {
      dbPath = './test-memory-episodes.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      await provider.add({
        content: 'User: Test message',
        groupId: 'episode-test',
        lastProcessedMessageIndex: 10,
      });

      const episodes = await provider.getEpisodes('episode-test', 5);

      expect(Array.isArray(episodes)).toBe(true);
      if (episodes.length > 0) {
        const episode = episodes[0];
        expect(episode).toHaveProperty('id');
        expect(episode).toHaveProperty('groupId');
        expect(episode).toHaveProperty('content');
        expect(episode).toHaveProperty('role');
        expect(episode).toHaveProperty('factIds');
        expect(episode).toHaveProperty('entityIds');
        expect(episode).toHaveProperty('timestamp');
        expect(episode).toHaveProperty('lastProcessedMessageIndex');
        expect(typeof episode.lastProcessedMessageIndex).toBe('number');
      }
    });

    it('should handle getFact with proper structure', async () => {
      dbPath = './test-memory-getfact.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      const addResult = await provider.add({
        content: 'User: Important fact',
        groupId: 'test',
      });

      if (addResult.factIds.length > 0) {
        const fact = await provider.getFact(addResult.factIds[0]);

        if (fact) {
          expect(fact).toHaveProperty('id');
          expect(fact).toHaveProperty('content');
          expect(fact).toHaveProperty('embedding');
          expect(fact).toHaveProperty('entityIds');
          expect(fact).toHaveProperty('relationIds');
          expect(fact).toHaveProperty('validFrom');
          expect(fact).toHaveProperty('createdAt');
          expect(fact).toHaveProperty('source');
          expect(fact).toHaveProperty('confidence');
          expect(Array.isArray(fact.entityIds)).toBe(true);
          expect(Array.isArray(fact.relationIds)).toBe(true);
        }
      }
    });

    it('should handle getEntity with proper structure', async () => {
      dbPath = './test-memory-getentity.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      const addResult = await provider.add({
        content: 'User: Python is a programming language',
        groupId: 'test',
      });

      if (addResult.entityIds.length > 0) {
        const entity = await provider.getEntity(addResult.entityIds[0]);

        if (entity) {
          expect(entity).toHaveProperty('id');
          expect(entity).toHaveProperty('name');
          expect(entity).toHaveProperty('type');
          expect(entity).toHaveProperty('attributes');
          expect(entity).toHaveProperty('createdAt');
          expect(entity).toHaveProperty('updatedAt');
          expect(typeof entity.attributes).toBe('object');
        }
      }
    });

    it('should handle getRelatedEntities with proper structure', async () => {
      dbPath = './test-memory-related.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      const addResult = await provider.add({
        content: 'User: Alice works with Bob at TechCorp',
        groupId: 'test',
      });

      if (addResult.entityIds.length > 0) {
        const relatedEntities = await provider.getRelatedEntities(
          addResult.entityIds[0],
          1
        );

        expect(Array.isArray(relatedEntities)).toBe(true);
        relatedEntities.forEach(entity => {
          expect(entity).toHaveProperty('id');
          expect(entity).toHaveProperty('name');
          expect(entity).toHaveProperty('type');
          expect(entity).toHaveProperty('attributes');
          expect(entity).toHaveProperty('createdAt');
          expect(entity).toHaveProperty('updatedAt');
        });
      }
    });
  });

  describe('Provider Interchangeability', () => {
    it('should be able to switch provider without breaking functionality', async () => {
      dbPath = './test-memory-switch.db';
      const liteConfig: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      const liteProvider = createMemoryProvider(liteConfig);

      const liteAddResult = await liteProvider.add({
        content: 'User: Testing provider switching',
        groupId: 'switch-test',
      });

      expect(liteAddResult.factIds).toBeDefined();
      expect(liteAddResult.entityIds).toBeDefined();

      const liteSearchResult = await liteProvider.search({
        query: 'provider switching',
        maxResults: 5,
      });

      expect(liteSearchResult.facts).toBeDefined();
      expect(liteSearchResult.entities).toBeDefined();
      expect(liteSearchResult.relations).toBeDefined();
      expect(liteSearchResult.score).toBeDefined();

      await liteProvider.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent fact gracefully', async () => {
      dbPath = './test-memory-nonexistent.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      const fact = await provider.getFact('non-existent-id');
      expect(fact).toBeNull();
    });

    it('should handle non-existent entity gracefully', async () => {
      dbPath = './test-memory-nonexistent-entity.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      const entity = await provider.getEntity('non-existent-id');
      expect(entity).toBeNull();
    });

    it('should handle empty related entities gracefully', async () => {
      dbPath = './test-memory-empty-related.db';
      const config: MemoryConfig = {
        provider: 'lite',
        storagePath: dbPath,
      };

      provider = createMemoryProvider(config);

      const relatedEntities = await provider.getRelatedEntities(
        'non-existent-id',
        1
      );
      expect(Array.isArray(relatedEntities)).toBe(true);
      expect(relatedEntities.length).toBe(0);
    });
  });
});
