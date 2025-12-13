import { tool } from 'ai';
import { z } from 'zod';

import { createAutoMemoryProvider } from '../core/memory/factory.js';

import type { MemoryProvider } from '../core/memory/types.js';

let memoryProviderPromise: Promise<MemoryProvider> | null = null;
let isClosing = false;

function getProvider(): Promise<MemoryProvider> {
  if (isClosing) {
    throw new Error('Memory provider is shutting down');
  }
  if (!memoryProviderPromise) {
    memoryProviderPromise = createAutoMemoryProvider({
      storagePath: process.env['MEMORY_DB_PATH'] || './memory.db',
      graphitiUrl: process.env['GRAPHITI_URL'],
      embeddingModel: process.env['MEMORY_EMBEDDING_MODEL'],
      extractionModel: process.env['MEMORY_EXTRACTION_MODEL'],
    });
  }
  return memoryProviderPromise;
}

export const memoryAddTool = tool({
  description: `Add content to memory. Automatically extracts entities and relationships to build a knowledge graph.`,
  inputSchema: z.object({
    content: z.string().describe('The content to remember'),
    role: z.enum(['user', 'assistant', 'system']).optional().describe('Role of the speaker'),
    groupId: z.string().optional().describe('Group ID to organize related memories (default: "default")'),
    source: z.string().optional().describe('Source of this memory'),
  }),
  execute: async ({ content, role = 'user', groupId = 'default', source }: { content: string; role?: 'user' | 'assistant' | 'system'; groupId?: string; source?: string }) => {
    try {
      const provider = await getProvider();
      const result = await provider.add({ content, role, groupId, source });
      return JSON.stringify({ success: true, ...result });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memorySearchTool = tool({
  description: `Search memory for relevant facts and relationships. Uses semantic search with embedding similarity.`,
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    groupIds: z.array(z.string()).optional().describe('Limit search to specific groups'),
    maxResults: z.number().optional().describe('Max results to return (default: 10)'),
  }),
  execute: async ({ query, groupIds, maxResults = 10 }: { query: string; groupIds?: string[]; maxResults?: number }) => {
    try {
      const provider = await getProvider();
      const result = await provider.search({ query, groupIds, maxResults });

      const sanitized = {
        facts: result.facts.map(f => ({
          id: f.id,
          content: f.content,
          entityIds: f.entityIds,
          validFrom: f.validFrom,
          validTo: f.validTo,
          confidence: f.confidence,
          source: f.source,
        })),
        entities: result.entities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          attributes: e.attributes,
        })),
        relations: result.relations,
        score: result.score,
      };

      return JSON.stringify(sanitized);
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memoryGetEpisodesTool = tool({
  description: `Get recent episodes (memories) for a group.`,
  inputSchema: z.object({
    groupId: z.string().describe('Group ID to get episodes from'),
    limit: z.number().optional().describe('Number of recent episodes to retrieve (default: 10)'),
  }),
  execute: async ({ groupId, limit = 10 }: { groupId: string; limit?: number }) => {
    try {
      const provider = await getProvider();
      const result = await provider.getEpisodes(groupId, limit);
      return JSON.stringify(result);
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memoryGetFactTool = tool({
  description: `Get details about a specific fact by ID.`,
  inputSchema: z.object({
    factId: z.string().describe('ID of the fact to retrieve'),
  }),
  execute: async ({ factId }: { factId: string }) => {
    try {
      const provider = await getProvider();
      const fact = await provider.getFact(factId);
      if (!fact) {
        return JSON.stringify({ error: 'Fact not found' });
      }
      const sanitized = {
        id: fact.id,
        content: fact.content,
        entityIds: fact.entityIds,
        relationIds: fact.relationIds,
        validFrom: fact.validFrom,
        validTo: fact.validTo,
        confidence: fact.confidence,
        source: fact.source,
        createdAt: fact.createdAt,
      };
      return JSON.stringify(sanitized);
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memoryGetEntityTool = tool({
  description: `Get details about a specific entity by ID.`,
  inputSchema: z.object({
    entityId: z.string().describe('ID of the entity to retrieve'),
  }),
  execute: async ({ entityId }: { entityId: string }) => {
    try {
      const provider = await getProvider();
      const entity = await provider.getEntity(entityId);
      if (!entity) {
        return JSON.stringify({ error: 'Entity not found' });
      }
      const sanitized = {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        attributes: entity.attributes,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };
      return JSON.stringify(sanitized);
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memoryGetRelatedTool = tool({
  description: `Get entities related to a given entity through the knowledge graph.`,
  inputSchema: z.object({
    entityId: z.string().describe('ID of the entity to find relations for'),
    depth: z.number().optional().describe('How many hops to traverse (default: 1)'),
  }),
  execute: async ({ entityId, depth = 1 }: { entityId: string; depth?: number }) => {
    try {
      const provider = await getProvider();
      const entities = await provider.getRelatedEntities(entityId, depth);
      const sanitized = entities.map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        attributes: e.attributes,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
      return JSON.stringify(sanitized);
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memoryTools = {
  memory_search: memorySearchTool,
  memory_get_episodes: memoryGetEpisodesTool,
  memory_get_fact: memoryGetFactTool,
  memory_get_entity: memoryGetEntityTool,
  memory_get_related: memoryGetRelatedTool,
};

export async function getMemoryProvider(): Promise<MemoryProvider> {
  return getProvider();
}

export async function closeMemory(): Promise<void> {
  if (memoryProviderPromise) {
    isClosing = true;
    try {
      const provider = await memoryProviderPromise;
      await provider.close();
    } finally {
      memoryProviderPromise = null;
      isClosing = false;
    }
  }
}

