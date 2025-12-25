import { tool } from 'ai';
import { z } from 'zod';

import { success, error } from './utils/tool-result.js';
import { ToolError, ToolErrorType } from './middleware/index.js';
import { createAutoMemoryProvider, type MemoryProvider } from '@agent/memory';

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

const DESCRIPTION = `A unified tool for knowledge graph memory operations: adding, searching, and retrieving information.
This tool manages a persistent knowledge base that extracts entities and relationships from content.

When to use this tool:
- Storing important information for later recall
- Searching for previously learned facts
- Looking up entities, facts, or relationships from past conversations
- Building contextual knowledge about users, projects, or topics

When NOT to use this tool:
- Searching the web → use web tool
- Reading local files → use fs tool
- Temporary data that doesn't need persistence

Memory concepts:
- Facts: Individual pieces of information with confidence scores
- Entities: Named things (people, projects, concepts) with attributes
- Relations: Connections between entities (e.g., "Alice works on Project X")
- Groups: Organizational units for related memories
- Episodes: Chronological records of interactions

Actions:
- add: Store new content, automatically extracting entities and relationships
- search: Semantic search across all memory for relevant facts
- episodes: Get recent memories for a specific group
- fact: Get details about a specific fact by ID
- entity: Get details about a specific entity by ID
- related: Get entities related to a given entity

Parameters explained:
- action: Required. One of: add, search, episodes, fact, entity, related
- content: For add. The content to remember.
- role: For add. Speaker role (user/assistant/system).
- groupId: For add/episodes. Group ID to organize memories.
- query: For search. The search query.
- maxResults: For search. Max results to return.
- factId: For fact. The fact ID to retrieve.
- entityId: For entity/related. The entity ID.
- depth: For related. How many relationship hops to traverse.

You should:
1. Add important information that may be useful later
2. Search memory before asking the user for repeated information
3. Use groups to organize memories by context (project, topic, etc.)
4. Retrieve related entities to build context`;

const memoryInputSchema = z.object({
  action: z.enum(['add', 'search', 'episodes', 'fact', 'entity', 'related']).describe('Memory operation'),

  content: z.string().optional().describe('For add: content to remember'),
  role: z.enum(['user', 'assistant', 'system']).optional().describe('For add: speaker role'),
  groupId: z.string().optional().describe('For add/episodes: group ID'),
  source: z.string().optional().describe('For add: source of this memory'),

  query: z.string().optional().describe('For search: search query'),
  groupIds: z.array(z.string()).optional().describe('For search: limit to groups'),
  maxResults: z.number().optional().describe('For search/episodes: max results'),

  factId: z.string().optional().describe('For fact: fact ID'),
  entityId: z.string().optional().describe('For entity/related: entity ID'),
  depth: z.number().optional().describe('For related: hop depth'),
});

export const createMemoryTool = () => {
  return tool({
    description: DESCRIPTION,
    inputSchema: memoryInputSchema,
    execute: async (input) => {
      const { action } = input;
      const provider = await getProvider();

      switch (action) {
        case 'add': {
          const { content, role = 'user', groupId = 'default', source } = input;
          
          if (!content) {
            throw new ToolError('content is required for add action', ToolErrorType.INVALID_INPUT);
          }

          const result = await provider.add({ content, role, groupId, source });
          return success({
            action: 'add',
            ...result,
          });
        }

        case 'search': {
          const { query, groupIds, maxResults = 10 } = input;
          
          if (!query) {
            throw new ToolError('query is required for search action', ToolErrorType.INVALID_INPUT);
          }

          const result = await provider.search({ query, groupIds, maxResults });
          return success({
            action: 'search',
            query,
            factsCount: result.facts.length,
            entitiesCount: result.entities.length,
            facts: result.facts.map(f => ({
              id: f.id,
              content: f.content,
              confidence: f.confidence,
              source: f.source,
            })),
            entities: result.entities.map(e => ({
              id: e.id,
              name: e.name,
              type: e.type,
            })),
            relations: result.relations,
          });
        }

        case 'episodes': {
          const { groupId, maxResults = 10 } = input;
          
          if (!groupId) {
            throw new ToolError('groupId is required for episodes action', ToolErrorType.INVALID_INPUT);
          }

          const episodes = await provider.getEpisodes(groupId, maxResults);
          return success({
            action: 'episodes',
            groupId,
            count: episodes.length,
            episodes,
          });
        }

        case 'fact': {
          const { factId } = input;
          
          if (!factId) {
            throw new ToolError('factId is required for fact action', ToolErrorType.INVALID_INPUT);
          }

          const fact = await provider.getFact(factId);
          if (!fact) {
            return error('Fact not found', { factId });
          }

          return success({
            action: 'fact',
            id: fact.id,
            content: fact.content,
            entityIds: fact.entityIds,
            relationIds: fact.relationIds,
            validFrom: fact.validFrom,
            validTo: fact.validTo,
            confidence: fact.confidence,
            source: fact.source,
            createdAt: fact.createdAt,
          });
        }

        case 'entity': {
          const { entityId } = input;
          
          if (!entityId) {
            throw new ToolError('entityId is required for entity action', ToolErrorType.INVALID_INPUT);
          }

          const entity = await provider.getEntity(entityId);
          if (!entity) {
            return error('Entity not found', { entityId });
          }

          return success({
            action: 'entity',
            id: entity.id,
            name: entity.name,
            type: entity.type,
            attributes: entity.attributes,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
          });
        }

        case 'related': {
          const { entityId, depth = 1 } = input;
          
          if (!entityId) {
            throw new ToolError('entityId is required for related action', ToolErrorType.INVALID_INPUT);
          }

          const entities = await provider.getRelatedEntities(entityId, depth);
          return success({
            action: 'related',
            entityId,
            depth,
            count: entities.length,
            entities: entities.map(e => ({
              id: e.id,
              name: e.name,
              type: e.type,
              attributes: e.attributes,
            })),
          });
        }

        default:
          throw new ToolError(`Unknown action: ${action}`, ToolErrorType.INVALID_INPUT);
      }
    },
  });
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

export const memoryTool = createMemoryTool();
