import { tool } from 'ai';
import { z } from 'zod';
import type { MemoryProvider } from '../core/memory/types.js';
import { createAutoMemoryProvider } from '../core/memory/factory.js';

let memoryProvider: MemoryProvider | null = null;

async function getProvider(): Promise<MemoryProvider> {
  if (!memoryProvider) {
    memoryProvider = await createAutoMemoryProvider({
      storagePath: process.env.MEMORY_DB_PATH || './memory.db',
    });
  }
  return memoryProvider;
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
      return JSON.stringify(result);
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
      const result = await provider.getFact(factId);
      return JSON.stringify(result);
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
      const result = await provider.getEntity(entityId);
      return JSON.stringify(result);
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
      const result = await provider.getRelatedEntities(entityId, depth);
      return JSON.stringify(result);
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memoryTools = {
  memory_add: memoryAddTool,
  memory_search: memorySearchTool,
  memory_get_episodes: memoryGetEpisodesTool,
  memory_get_fact: memoryGetFactTool,
  memory_get_entity: memoryGetEntityTool,
  memory_get_related: memoryGetRelatedTool,
};

export async function closeMemory(): Promise<void> {
  if (memoryProvider) {
    await memoryProvider.close();
    memoryProvider = null;
  }
}

