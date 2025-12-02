import type {
  MemoryProvider,
  MemoryAddInput,
  MemorySearchInput,
  SearchResult,
  Fact,
  Entity,
  Episode,
  Relation,
} from './types.js';

export function normalizeEntity(data: Partial<Entity>): Entity {
  return {
    id: data.id || '',
    name: data.name || '',
    type: data.type || 'unknown',
    attributes: data.attributes || {},
    embedding: data.embedding,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
  };
}

export function normalizeFact(data: Partial<Fact>): Fact {
  return {
    id: data.id || '',
    content: data.content || '',
    embedding: data.embedding || [],
    entityIds: data.entityIds || [],
    relationIds: data.relationIds || [],
    validFrom: data.validFrom || new Date(),
    validTo: data.validTo !== undefined ? data.validTo : null,
    createdAt: data.createdAt || new Date(),
    source: data.source || 'unknown',
    confidence: data.confidence ?? 1.0,
  };
}

export function normalizeEpisode(data: Partial<Episode>): Episode {
  return {
    id: data.id || '',
    groupId: data.groupId || 'default',
    content: data.content || '',
    role: data.role || 'user',
    factIds: data.factIds || [],
    entityIds: data.entityIds || [],
    timestamp: data.timestamp || new Date(),
    lastProcessedMessageIndex: data.lastProcessedMessageIndex ?? 0,
  };
}

export function normalizeRelation(data: Partial<Relation>): Relation {
  return {
    id: data.id || '',
    fromEntityId: data.fromEntityId || '',
    toEntityId: data.toEntityId || '',
    type: data.type || 'related_to',
    weight: data.weight ?? 0.8,
    attributes: data.attributes || {},
    createdAt: data.createdAt || new Date(),
  };
}

export function normalizeSearchResult(data: Partial<SearchResult>): SearchResult {
  return {
    facts: (data.facts || []).map(normalizeFact),
    entities: (data.entities || []).map(normalizeEntity),
    relations: (data.relations || []).map(normalizeRelation),
    score: data.score ?? 0,
  };
}

export abstract class BaseMemoryProvider implements MemoryProvider {
  abstract add(input: MemoryAddInput): Promise<{ factIds: string[]; entityIds: string[] }>;
  abstract search(input: MemorySearchInput): Promise<SearchResult>;
  abstract getEpisodes(groupId: string, limit?: number): Promise<Episode[]>;
  abstract getFact(factId: string): Promise<Fact | null>;
  abstract getEntity(entityId: string): Promise<Entity | null>;
  abstract getRelatedEntities(entityId: string, depth?: number): Promise<Entity[]>;
  abstract invalidateFact(factId: string): Promise<void>;
  abstract close(): Promise<void>;

  protected validateAddResult(result: { factIds: string[]; entityIds: string[] }): void {
  }

  protected validateSearchResult(result: SearchResult): SearchResult {
    return normalizeSearchResult(result);
  }

  protected validateEpisodes(episodes: Episode[]): Episode[] {
    return episodes.map(normalizeEpisode);
  }

  protected validateFact(fact: Fact | null): Fact | null {
    if (fact === null) return null;
    return normalizeFact(fact);
  }

  protected validateEntity(entity: Entity | null): Entity | null {
    if (entity === null) return null;
    return normalizeEntity(entity);
  }

  protected validateEntities(entities: Entity[]): Entity[] {
    return entities.map(normalizeEntity);
  }
}
