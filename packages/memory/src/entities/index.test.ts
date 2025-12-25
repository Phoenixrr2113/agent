import fs from 'node:fs/promises';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createInMemoryStorage } from '../storage/index.js';

import { createMemoryLite } from ".";

import type { StorageAdapter, Entity, Fact } from './types.js';

// Skip tests that require real API keys in CI
const hasRealApiKeys =
  process.env.OPENROUTER_API_KEY &&
  !process.env.OPENROUTER_API_KEY.includes('test') &&
  !process.env.CI;

describe('MemoryLite Provider', () => {
  let storage: StorageAdapter;
  let dbPath: string;

  beforeEach(async () => {
    storage = createInMemoryStorage();
  });

  afterEach(async () => {
    await storage.close();
    if (dbPath) {
      try {
        await fs.unlink(dbPath);
      } catch {}
    }
  });

  describe('Fact Content Normalization', () => {
    it.skipIf(!hasRealApiKeys)('should detect duplicate facts with different punctuation', async () => {
      const provider = createMemoryLite({ storage });

      await provider.add({
        content: 'User: My favorite language is Python\nAssistant: Great choice!',
        groupId: 'test',
      });

      const facts1 = await storage.facts.findByGroup('test');
      const initialCount = facts1.length;

      await provider.add({
        content: 'User: My favorite language is Python.\nAssistant: I agree!',
        groupId: 'test',
      });

      const facts2 = await storage.facts.findByGroup('test');
      const duplicateFacts = facts2.filter(f =>
        f.content.toLowerCase().includes('favorite language is python')
      );

      expect(duplicateFacts.length).toBeLessThanOrEqual(1);
    });

    it.skipIf(!hasRealApiKeys)('should detect duplicate facts with different casing', async () => {
      const provider = createMemoryLite({ storage });

      await provider.add({
        content: 'User: I live in San Francisco\nAssistant: Nice city!',
        groupId: 'test',
      });

      await provider.add({
        content: 'User: I LIVE IN SAN FRANCISCO\nAssistant: Cool!',
        groupId: 'test',
      });

      const facts = await storage.facts.findByGroup('test');
      const locationFacts = facts.filter(f =>
        f.content.toLowerCase().includes('san francisco')
      );

      expect(locationFacts.length).toBeLessThanOrEqual(1);
    });

    it.skipIf(!hasRealApiKeys)('should handle facts with trailing whitespace', async () => {
      const provider = createMemoryLite({ storage });

      await provider.add({
        content: 'User: My name is Alice  \nAssistant: Hello Alice!',
        groupId: 'test',
      });

      await provider.add({
        content: 'User: My name is Alice\nAssistant: Hi!',
        groupId: 'test',
      });

      const facts = await storage.facts.findByGroup('test');
      const nameFacts = facts.filter(f =>
        f.content.toLowerCase().includes('name is alice')
      );

      expect(nameFacts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Temporal Fact Supersession', () => {
    it.skipIf(!hasRealApiKeys)('should invalidate old facts when superseded', async () => {
      const provider = createMemoryLite({ storage });

      await provider.add({
        content: 'User: My favorite color is blue\nAssistant: Blue is nice!',
        groupId: 'test',
      });

      const facts1 = await storage.facts.findByGroup('test');
      const blueFact = facts1.find(f => f.content.toLowerCase().includes('blue'));
      expect(blueFact).toBeDefined();
      expect(blueFact?.validTo).toBeNull();

      await provider.add({
        content: 'User: Actually, I changed my mind. My favorite color is red now.\nAssistant: Red is great!',
        groupId: 'test',
      });

      const facts2 = await storage.facts.findByGroup('test');
      const updatedBlueFact = facts2.find(f => f.id === blueFact?.id);
      
      if (updatedBlueFact) {
        expect(updatedBlueFact.validTo).not.toBeNull();
      }

      const redFact = facts2.find(f => 
        f.content.toLowerCase().includes('red') && 
        f.validTo === null
      );
      expect(redFact).toBeDefined();
    });

    it.skipIf(!hasRealApiKeys)('should maintain valid facts when no contradiction', async () => {
      const provider = createMemoryLite({ storage });

      await provider.add({
        content: 'User: I like Python\nAssistant: Great!',
        groupId: 'test',
      });

      await provider.add({
        content: 'User: I also like TypeScript\nAssistant: Nice!',
        groupId: 'test',
      });

      const facts = await storage.facts.findByGroup('test');
      const validFacts = facts.filter(f => f.validTo === null);

      expect(validFacts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Entity Conflict Resolution', () => {
    it.skipIf(!hasRealApiKeys)('should merge entities with same name', async () => {
      const provider = createMemoryLite({ storage });

      await provider.add({
        content: 'User: Python is a programming language\nAssistant: Yes!',
        groupId: 'test',
      });

      const entities1 = await storage.entities.findByGroup('test');
      const pythonEntity1 = entities1.find(e => 
        e.name.toLowerCase() === 'python'
      );

      await provider.add({
        content: 'User: Python is great for data science\nAssistant: Agreed!',
        groupId: 'test',
      });

      const entities2 = await storage.entities.findByGroup('test');
      const pythonEntities = entities2.filter(e => 
        e.name.toLowerCase() === 'python'
      );

      expect(pythonEntities.length).toBe(1);
    });
  });

  describe('Episode Tracking', () => {
    it.skipIf(!hasRealApiKeys)('should create episodes with message index', async () => {
      const provider = createMemoryLite({ storage });

      await provider.add({
        content: 'User: Test message\nAssistant: Response',
        groupId: 'test',
        lastProcessedMessageIndex: 5,
      });

      const episodes = await storage.episodes.findByGroup('test');
      expect(episodes.length).toBe(1);
      expect(episodes[0].lastProcessedMessageIndex).toBe(5);
    });

    it.skipIf(!hasRealApiKeys)('should link facts and entities to episodes', async () => {
      const provider = createMemoryLite({ storage });

      const result = await provider.add({
        content: 'User: My name is Bob and I like coding\nAssistant: Cool!',
        groupId: 'test',
      });

      const episodes = await storage.episodes.findByGroup('test');
      expect(episodes.length).toBe(1);
      expect(episodes[0].factIds.length).toBeGreaterThan(0);
      expect(episodes[0].entityIds.length).toBeGreaterThan(0);
    });
  });
});

