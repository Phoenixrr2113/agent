import { embed } from 'ai';
import { google } from '@ai-sdk/google';
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
import type { StorageAdapter } from './storage.js';
import { createInMemoryStorage } from './storage.js';
import { createSQLiteStorage } from './storage-sqlite.js';
import { extractFromText, detectContradictions, resolveEntityConflicts } from './extraction.js';

export * from './types.js';
export { createInMemoryStorage } from './storage.js';
export { createSQLiteStorage } from './storage-sqlite.js';

const DEFAULT_EXTRACTION_MODEL = process.env.MODEL_EXTRACTION || process.env.MODEL_STANDARD || 'google/gemini-2.0-flash-001';

export function createMemoryLite(config: Omit<MemoryConfig, 'provider'>): MemoryProvider {
  const storage: StorageAdapter = config.storagePath
    ? createSQLiteStorage(config.storagePath)
    : createInMemoryStorage();

  const openrouter = createOpenRouter();
  const embeddingModel = google.embedding(config.embeddingModel || 'text-embedding-004');
  const extractionModel = openrouter(config.extractionModel || DEFAULT_EXTRACTION_MODEL);

  async function getEmbedding(text: string): Promise<number[]> {
    const { embedding } = await embed({ model: embeddingModel as any, value: text });
    return embedding;
  }

  async function getOrCreateEntity(
    extracted: { name: string; type: string; attributes: Record<string, unknown> }
  ): Promise<Entity> {
    const existing = await storage.entities.findByName(extracted.name);

    if (existing) {
      const resolution = await resolveEntityConflicts(extracted, existing, extractionModel);
      if (resolution.shouldMerge && resolution.mergedAttributes) {
        await storage.entities.update(existing.id, { attributes: resolution.mergedAttributes });
        return { ...existing, attributes: resolution.mergedAttributes };
      }
      return existing;
    }

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
    return entity;
  }

  return {
    async add(input: MemoryAddInput) {
      const existingEntities = (await storage.entities.all()).map(e => e.name);
      const extracted = await extractFromText(input.content, extractionModel, existingEntities);

      const entityMap = new Map<string, Entity>();
      for (const e of extracted.entities) {
        const entity = await getOrCreateEntity(e);
        entityMap.set(e.name, entity);
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
      for (const f of extracted.facts) {
        const relatedEntityIds = f.entityNames
          .map(name => entityMap.get(name)?.id)
          .filter((id): id is string => !!id);

        const existingFacts = await storage.facts.findValid();
        const contradictions = await detectContradictions(
          f.content,
          existingFacts.map(ef => ef.content),
          extractionModel
        );

        for (const supersededContent of contradictions.supersedes) {
          const superseded = existingFacts.find(ef => ef.content === supersededContent);
          if (superseded) {
            await storage.facts.invalidate(superseded.id, new Date());
          }
        }

        const embedding = await getEmbedding(f.content);
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
      }

      const episode: Episode = {
        id: randomUUID(),
        groupId: input.groupId || 'default',
        content: input.content,
        role: input.role || 'user',
        factIds,
        entityIds: Array.from(entityMap.values()).map(e => e.id),
        timestamp: new Date(),
      };
      await storage.episodes.create(episode);

      return { factIds, entityIds: Array.from(entityMap.values()).map(e => e.id) };
    },

    async search(input: MemorySearchInput): Promise<SearchResult> {
      const queryEmbedding = await getEmbedding(input.query);
      const factResults = await storage.facts.search(
        queryEmbedding,
        input.maxResults || 10,
        input.includeExpired
      );

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
}

