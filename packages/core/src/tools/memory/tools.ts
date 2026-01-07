import { tool } from 'ai';

import { success, error } from '../utils/tool-result.js';
import { ToolError, ToolErrorType } from '../middleware/index.js';

import { MEMORY_DESCRIPTION, DEFAULT_GROUP_ID, DEFAULT_MAX_RESULTS, DEFAULT_DEPTH } from './constants.js';
import { memoryInputSchema } from './types.js';
import { getProvider } from './provider.js';

export function createMemoryTool() {
  return tool({
    description: MEMORY_DESCRIPTION,
    inputSchema: memoryInputSchema,
    execute: async (input) => {
      const { action } = input;
      const provider = await getProvider();

      switch (action) {
        case 'add': {
          const { content, role = 'user', groupId = DEFAULT_GROUP_ID, source } = input;
          
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
          const { query, groupIds, maxResults = DEFAULT_MAX_RESULTS } = input;
          
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
          const { groupId, maxResults = DEFAULT_MAX_RESULTS } = input;
          
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
          const { entityId, depth = DEFAULT_DEPTH } = input;
          
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
}

export const memoryTool = createMemoryTool();

// Direct export for testing
export const executeMemory = memoryTool.execute!;
