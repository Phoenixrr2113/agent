import type { Entity, Relation, Fact, Episode } from './types.js';

export interface StorageAdapter {
  entities: {
    create(entity: Entity): Promise<void>;
    update(id: string, updates: Partial<Entity>): Promise<void>;
    get(id: string): Promise<Entity | null>;
    findByName(name: string): Promise<Entity | null>;
    findByType(type: string): Promise<Entity[]>;
    search(embedding: number[], limit: number): Promise<Array<{ entity: Entity; score: number }>>;
    all(): Promise<Entity[]>;
  };

  relations: {
    create(relation: Relation): Promise<void>;
    get(id: string): Promise<Relation | null>;
    findByEntity(entityId: string): Promise<Relation[]>;
    findBetween(fromId: string, toId: string): Promise<Relation[]>;
    all(): Promise<Relation[]>;
  };

  facts: {
    create(fact: Fact): Promise<void>;
    update(id: string, updates: Partial<Fact>): Promise<void>;
    get(id: string): Promise<Fact | null>;
    findByEntity(entityId: string): Promise<Fact[]>;
    findValid(asOf?: Date): Promise<Fact[]>;
    search(embedding: number[], limit: number, includeExpired?: boolean): Promise<Array<{ fact: Fact; score: number }>>;
    invalidate(id: string, validTo: Date): Promise<void>;
  };

  episodes: {
    create(episode: Episode): Promise<void>;
    get(id: string): Promise<Episode | null>;
    findByGroup(groupId: string, limit?: number): Promise<Episode[]>;
  };

  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  return dot / magnitude;
}

export function createInMemoryStorage(): StorageAdapter {
  const entities = new Map<string, Entity>();
  const relations = new Map<string, Relation>();
  const facts = new Map<string, Fact>();
  const episodes = new Map<string, Episode>();

  return {
    entities: {
      async create(entity) { entities.set(entity.id, entity); },
      async update(id, updates) {
        const existing = entities.get(id);
        if (existing) entities.set(id, { ...existing, ...updates, updatedAt: new Date() });
      },
      async get(id) { return entities.get(id) || null; },
      async findByName(name) {
        for (const e of entities.values()) {
          if (e.name.toLowerCase() === name.toLowerCase()) return e;
        }
        return null;
      },
      async findByType(type) {
        return Array.from(entities.values()).filter(e => e.type === type);
      },
      async search(embedding, limit) {
        return Array.from(entities.values())
          .filter((e): e is Entity & { embedding: number[] } => e.embedding !== undefined && e.embedding !== null)
          .map(e => ({ entity: e, score: cosineSimilarity(embedding, e.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      },
      async all() { return Array.from(entities.values()); },
    },

    relations: {
      async create(relation) { relations.set(relation.id, relation); },
      async get(id) { return relations.get(id) || null; },
      async findByEntity(entityId) {
        return Array.from(relations.values()).filter(
          r => r.fromEntityId === entityId || r.toEntityId === entityId
        );
      },
      async findBetween(fromId, toId) {
        return Array.from(relations.values()).filter(
          r => r.fromEntityId === fromId && r.toEntityId === toId
        );
      },
      async all() { return Array.from(relations.values()); },
    },

    facts: {
      async create(fact) { facts.set(fact.id, fact); },
      async update(id, updates) {
        const existing = facts.get(id);
        if (existing) facts.set(id, { ...existing, ...updates });
      },
      async get(id) { return facts.get(id) || null; },
      async findByEntity(entityId) {
        return Array.from(facts.values()).filter(f => f.entityIds.includes(entityId));
      },
      async findValid(asOf = new Date()) {
        return Array.from(facts.values()).filter(
          f => f.validFrom <= asOf && (f.validTo === null || f.validTo > asOf)
        );
      },
      async search(embedding, limit, includeExpired = false) {
        const now = new Date();
        return Array.from(facts.values())
          .filter(f => includeExpired || (f.validFrom <= now && (f.validTo === null || f.validTo > now)))
          .map(f => ({ fact: f, score: cosineSimilarity(embedding, f.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      },
      async invalidate(id, validTo) {
        const fact = facts.get(id);
        if (fact) facts.set(id, { ...fact, validTo });
      },
    },

    episodes: {
      async create(episode) { episodes.set(episode.id, episode); },
      async get(id) { return episodes.get(id) || null; },
      async findByGroup(groupId, limit = 10) {
        return Array.from(episodes.values())
          .filter(e => e.groupId === groupId)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, limit);
      },
    },

    async transaction<T>(fn: () => Promise<T>) { return fn(); },
    async close() { entities.clear(); relations.clear(); facts.clear(); episodes.clear(); },
  };
}

