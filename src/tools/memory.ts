import { tool } from 'ai';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const GRAPHITI_URL = process.env.GRAPHITI_URL || 'http://localhost:8000';

async function graphitiRequest(path: string, method: string, body?: unknown) {
  const response = await fetch(`${GRAPHITI_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graphiti API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export const memoryAddTool = tool({
  description: `Add messages/content to memory. Graphiti extracts entities and relationships automatically and builds a knowledge graph.`,
  inputSchema: z.object({
    content: z.string().describe('The content to remember'),
    role: z.enum(['user', 'assistant', 'system']).optional().describe('Role of the speaker'),
    roleType: z.enum(['user', 'assistant', 'system']).optional().describe('Type of role'),
    groupId: z.string().optional().describe('Group ID to organize related memories (default: "default")'),
    name: z.string().optional().describe('Optional name/label for this message'),
  }),
  execute: async ({ content, role = 'user', roleType = 'user', groupId = 'default', name }: { content: string; role?: string; roleType?: string; groupId?: string; name?: string }) => {
    try {
      const result = await graphitiRequest('/messages', 'POST', {
        group_id: groupId,
        messages: [{
          uuid: randomUUID(),
          content,
          role,
          role_type: roleType,
          name: name || `memory_${Date.now()}`,
          timestamp: new Date().toISOString(),
          source_description: 'agent_memory',
        }],
      });
      return JSON.stringify({ success: true, result });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memorySearchTool = tool({
  description: `Search memory for relevant facts and relationships. Uses hybrid search (semantic + keyword + graph traversal).`,
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    groupIds: z.array(z.string()).optional().describe('Limit search to specific groups'),
    maxFacts: z.number().optional().describe('Max facts to return (default: 10)'),
  }),
  execute: async ({ query, groupIds, maxFacts = 10 }: { query: string; groupIds?: string[]; maxFacts?: number }) => {
    try {
      const result = await graphitiRequest('/search', 'POST', {
        query,
        group_ids: groupIds,
        max_facts: maxFacts,
      });
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
    lastN: z.number().optional().describe('Number of recent episodes to retrieve (default: 10)'),
  }),
  execute: async ({ groupId, lastN = 10 }: { groupId: string; lastN?: number }) => {
    try {
      const result = await graphitiRequest(`/episodes/${groupId}?last_n=${lastN}`, 'GET');
      return JSON.stringify(result);
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const memoryGetFactTool = tool({
  description: `Get details about a specific fact (edge/relationship) by UUID.`,
  inputSchema: z.object({
    uuid: z.string().describe('UUID of the fact/edge to retrieve'),
  }),
  execute: async ({ uuid }: { uuid: string }) => {
    try {
      const result = await graphitiRequest(`/entity-edge/${uuid}`, 'GET');
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
};

