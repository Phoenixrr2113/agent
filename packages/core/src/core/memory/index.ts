import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { randomUUID } from 'crypto';
import type {
  MemoryProvider,
  MemoryAddInput,
  MemorySearchInput,
  SearchResult,
  Entity,
  Fact,
  Episode,
  MemoryConfig,
} from './types.js';
import { createInMemoryStorage, type StorageAdapter } from './storage.js';
import { createSQLiteStorage } from './storage-sqlite.js';
import { extractFromText, detectContradictionsBatch, resolveEntityConflicts } from './extraction.js';
import { logger } from '@agent/shared';
import { BaseMemoryProvider } from './provider-base.js';

/**
 * Normalizes fact content for comparison to handle LLM extraction variations.
 * Removes trailing punctuation and normalizes case to prevent duplicates like:
 * "User's favorite language is Python" vs "User's favorite language is Python."
 */
function normalizeFactContent(content: string): string {
  return content
    .trim()
    .replace(/[.!?]+$/, '')
    .toLowerCase();
}

export * from './types.js';
export { createInMemoryStorage } from './storage.js';
export { createSQLiteStorage } from './storage-sqlite.js';
export { BaseMemoryProvider } from './provider-base.js';

const DEFAULT_EXTRACTION_MODEL = process.env.MODEL_EXTRACTION || process.env.MODEL_STANDARD || 'google/gemini-2.0-flash-001';

export function createMemoryLite(config: Omit<MemoryConfig, 'provider'>): MemoryProvider {
  const storage: StorageAdapter = config.storagePath
    ? createSQLiteStorage(config.storagePath)
    : createInMemoryStorage();

  const openrouter = createOpenRouter();
  const embeddingModel = openai.embedding(config.embeddingModel || 'text-embedding-3-small');
  const extractionModel = openrouter(config.extractionModel || DEFAULT_EXTRACTION_MODEL);

  async function getEmbedding(text: string): Promise<number[]> {
    const startTime = performance.now();
    const { embedding } = await embed({ model: embeddingModel, value: text });
    const duration = performance.now() - startTime;
    logger.debug('⏱️  [memory] Embedding generated', {
      durationMs: duration.toFixed(2),
      textLength: text.length,
    });
    return embedding;
  }

  async function getOrCreateEntity(
    extracted: { name: string; type: string; attributes: Record<string, unknown> }
  ): Promise<Entity> {
    const startTime = performance.now();
    const existing = await storage.entities.findByName(extracted.name);

    if (existing) {
      logger.debug('⏱️  [memory] Entity exists, checking conflicts', { name: extracted.name });
      const conflictStartTime = performance.now();
      const resolution = await resolveEntityConflicts(extracted, existing, extractionModel);
      const conflictDuration = performance.now() - conflictStartTime;
      logger.info('⏱️  [memory] Entity conflict resolution completed', {
        durationMs: conflictDuration.toFixed(2),
        name: extracted.name,
        shouldMerge: resolution.shouldMerge,
      });

      if (resolution.shouldMerge && resolution.mergedAttributes) {
        await storage.entities.update(existing.id, { attributes: resolution.mergedAttributes });
        return { ...existing, attributes: resolution.mergedAttributes };
      }
      const totalDuration = performance.now() - startTime;
      logger.debug('⏱️  [memory] Entity retrieved', {
        durationMs: totalDuration.toFixed(2),
        name: extracted.name,
      });
      return existing;
    }

    logger.debug('⏱️  [memory] Creating new entity', { name: extracted.name });
    const embedding = await getEmbedding(`${extracted.name} (${extracted.type}): ${JSON.stringify(extracted.attributes)}`);
    const entity: Entity = {
      id: randomUUID(),
      name: extracted.name,
      type: extracted.type,
      attributes: extracted.attributes,
      embedding,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await storage.entities.create(entity);
    const totalDuration = performance.now() - startTime;
    logger.info('⏱️  [memory] Entity created', {
      durationMs: totalDuration.toFixed(2),
      name: extracted.name,
    });
    return entity;
  }

  const implementation = {
    async add(input: MemoryAddInput) {
      const overallStartTime = performance.now();
      logger.info('⏱️  [memory] Starting memory add operation', {
        contentLength: input.content.length,
      });

      const existingEntities = (await storage.entities.all()).map(e => e.name);

      const extractionStartTime = performance.now();
      const extracted = await extractFromText(input.content, extractionModel, existingEntities);
      const extractionDuration = performance.now() - extractionStartTime;
      logger.info('⏱️  [memory] Text extraction completed', {
        durationMs: extractionDuration.toFixed(2),
        durationSec: (extractionDuration / 1000).toFixed(3),
        entitiesFound: extracted.entities.length,
        factsFound: extracted.facts.length,
        relationsFound: extracted.relations.length,
      });

      const entityProcessingStart = performance.now();
      const entities = await Promise.all(
        extracted.entities.map(e => getOrCreateEntity(e))
      );
      const entityProcessingDuration = performance.now() - entityProcessingStart;
      logger.info('⏱️  [memory] All entities processed (parallel)', {
        durationMs: entityProcessingDuration.toFixed(2),
        durationSec: (entityProcessingDuration / 1000).toFixed(3),
        count: entities.length,
      });

      const entityMap = new Map<string, Entity>();
      for (let i = 0; i < extracted.entities.length; i++) {
        entityMap.set(extracted.entities[i].name, entities[i]);
      }

      const relationIds: string[] = [];
      for (const r of extracted.relations) {
        const fromEntity = entityMap.get(r.fromEntity);
        const toEntity = entityMap.get(r.toEntity);
        if (fromEntity && toEntity) {
          const relation = {
            id: randomUUID(),
            fromEntityId: fromEntity.id,
            toEntityId: toEntity.id,
            type: r.type,
            weight: r.weight || 0.8,
            attributes: {},
            createdAt: new Date(),
          };
          await storage.relations.create(relation);
          relationIds.push(relation.id);
        }
      }

      const factIds: string[] = [];

      if (extracted.facts.length === 0) {
        logger.debug('⏱️  [memory] No facts to process');
      } else {
        const existingFacts = await storage.facts.findValid();

        const contradictionCheckStartTime = performance.now();
        logger.info('⏱️  [memory] Starting batch contradiction detection', {
          factCount: extracted.facts.length,
          existingFactCount: existingFacts.length,
        });

        const contradictionResults = await detectContradictionsBatch(
          extracted.facts.map(f => f.content),
          existingFacts.map(ef => ef.content),
          extractionModel
        );

        const contradictionCheckDuration = performance.now() - contradictionCheckStartTime;
        logger.info('⏱️  [memory] Batch contradiction detection completed', {
          durationMs: contradictionCheckDuration.toFixed(2),
          durationSec: (contradictionCheckDuration / 1000).toFixed(3),
          factCount: extracted.facts.length,
        });

        const embeddingBatchStartTime = performance.now();
        logger.info('⏱️  [memory] Starting batch embedding generation for facts', {
          factCount: extracted.facts.length,
        });

        const factEmbeddings = await Promise.all(
          extracted.facts.map(f => getEmbedding(f.content))
        );

        const embeddingBatchDuration = performance.now() - embeddingBatchStartTime;
        logger.info('⏱️  [memory] All fact embeddings generated (parallel)', {
          durationMs: embeddingBatchDuration.toFixed(2),
          durationSec: (embeddingBatchDuration / 1000).toFixed(3),
          factCount: extracted.facts.length,
        });

        for (let i = 0; i < extracted.facts.length; i++) {
          const f = extracted.facts[i];
          const contradictions = contradictionResults[i];
          const embedding = factEmbeddings[i];
          const factStartTime = performance.now();

          logger.debug(`⏱️  [memory] Processing fact ${i + 1}/${extracted.facts.length}`);

          const relatedEntityIds = f.entityNames
            .map(name => entityMap.get(name)?.id)
            .filter((id): id is string => !!id);

          for (const supersededContent of contradictions.supersedes) {
            const normalizedSuperseded = normalizeFactContent(supersededContent);
            const superseded = existingFacts.find(
              ef => normalizeFactContent(ef.content) === normalizedSuperseded
            );
            if (superseded) {
              logger.debug('⏱️  [memory] Invalidating superseded fact', {
                supersededId: superseded.id,
                supersededContent: superseded.content,
                newContent: f.content,
              });
              await storage.facts.invalidate(superseded.id, new Date());
            } else {
              logger.warn('⚠️  [memory] Could not find superseded fact to invalidate', {
                supersededContent,
                normalizedContent: normalizedSuperseded,
              });
            }
          }

          const fact: Fact = {
            id: randomUUID(),
            content: f.content,
            embedding,
            entityIds: relatedEntityIds,
            relationIds: [],
            validFrom: new Date(),
            validTo: null,
            createdAt: new Date(),
            source: input.source || 'user_input',
            confidence: f.confidence,
          };
          await storage.facts.create(fact);
          factIds.push(fact.id);

          const factDuration = performance.now() - factStartTime;
          logger.info(`⏱️  [memory] Fact ${i + 1}/${extracted.facts.length} processed`, {
            durationMs: factDuration.toFixed(2),
            durationSec: (factDuration / 1000).toFixed(3),
            supersedes: contradictions.supersedes.length,
          });
        }
      }

      const episode: Episode = {
        id: randomUUID(),
        groupId: input.groupId || 'default',
        content: input.content,
        role: input.role || 'user',
        factIds,
        entityIds: Array.from(entityMap.values()).map(e => e.id),
        timestamp: new Date(),
        lastProcessedMessageIndex: input.lastProcessedMessageIndex || 0,
      };
      await storage.episodes.create(episode);

      const overallDuration = performance.now() - overallStartTime;
      logger.info('⏱️  [memory] Memory add operation completed', {
        durationMs: overallDuration.toFixed(2),
        durationSec: (overallDuration / 1000).toFixed(3),
        factsCreated: factIds.length,
        entitiesCreated: Array.from(entityMap.values()).length,
      });

      return { factIds, entityIds: Array.from(entityMap.values()).map(e => e.id) };
    },

    async search(input: MemorySearchInput): Promise<SearchResult> {
      const startTime = performance.now();
      logger.info('⏱️  [memory] Starting memory search', { query: input.query });

      const queryEmbedding = await getEmbedding(input.query);

      const searchStartTime = performance.now();
      const factResults = await storage.facts.search(
        queryEmbedding,
        input.maxResults || 10,
        input.includeExpired
      );
      const searchDuration = performance.now() - searchStartTime;
      logger.debug('⏱️  [memory] Fact search completed', {
        durationMs: searchDuration.toFixed(2),
        resultsFound: factResults.length,
      });

      const entityIds = new Set<string>();
      const relationIds = new Set<string>();
      for (const { fact } of factResults) {
        fact.entityIds.forEach(id => entityIds.add(id));
        fact.relationIds.forEach(id => relationIds.add(id));
      }

      const entities = await Promise.all(
        Array.from(entityIds).map(id => storage.entities.get(id))
      ).then(results => results.filter((e): e is Entity => e !== null));

      const relations = await Promise.all(
        Array.from(relationIds).map(id => storage.relations.get(id))
      ).then(results => results.filter((r): r is NonNullable<typeof r> => r !== null));

      const totalDuration = performance.now() - startTime;
      logger.info('⏱️  [memory] Memory search completed', {
        durationMs: totalDuration.toFixed(2),
        durationSec: (totalDuration / 1000).toFixed(3),
        factsReturned: factResults.length,
        entitiesReturned: entities.length,
        relationsReturned: relations.length,
      });

      return {
        facts: factResults.map(r => r.fact),
        entities,
        relations,
        score: factResults[0]?.score || 0,
      };
    },

    async getEpisodes(groupId: string, limit = 10) {
      return storage.episodes.findByGroup(groupId, limit);
    },

    async getFact(factId: string) {
      return storage.facts.get(factId);
    },

    async getEntity(entityId: string) {
      return storage.entities.get(entityId);
    },

    async getRelatedEntities(entityId: string, depth = 1) {
      const visited = new Set<string>();
      const result: Entity[] = [];

      async function traverse(id: string, currentDepth: number) {
        if (currentDepth > depth || visited.has(id)) return;
        visited.add(id);

        const relations = await storage.relations.findByEntity(id);
        for (const rel of relations) {
          const otherId = rel.fromEntityId === id ? rel.toEntityId : rel.fromEntityId;
          if (!visited.has(otherId)) {
            const entity = await storage.entities.get(otherId);
            if (entity) {
              result.push(entity);
              await traverse(otherId, currentDepth + 1);
            }
          }
        }
      }

      await traverse(entityId, 0);
      return result;
    },

    async invalidateFact(factId: string) {
      await storage.facts.invalidate(factId, new Date());
    },

    async close() {
      await storage.close();
    },
  };

  class MemoryLiteProvider extends BaseMemoryProvider {
    async add(input: MemoryAddInput) {
      const result = await implementation.add(input);
      this.validateAddResult(result);
      return result;
    }

    async search(input: MemorySearchInput): Promise<SearchResult> {
      const result = await implementation.search(input);
      return this.validateSearchResult(result);
    }

    async getEpisodes(groupId: string, limit = 10): Promise<Episode[]> {
      const result = await implementation.getEpisodes(groupId, limit);
      return this.validateEpisodes(result);
    }

    async getFact(factId: string): Promise<Fact | null> {
      const result = await implementation.getFact(factId);
      return this.validateFact(result);
    }

    async getEntity(entityId: string): Promise<Entity | null> {
      const result = await implementation.getEntity(entityId);
      return this.validateEntity(result);
    }

    async getRelatedEntities(entityId: string, depth = 1): Promise<Entity[]> {
      const result = await implementation.getRelatedEntities(entityId, depth);
      return this.validateEntities(result);
    }

    async invalidateFact(factId: string): Promise<void> {
      await implementation.invalidateFact(factId);
    }

    async close(): Promise<void> {
      await implementation.close();
    }
  }

  return new MemoryLiteProvider();
}

