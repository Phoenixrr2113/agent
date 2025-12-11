import type { Entity, Relation, Fact, Episode } from '../types.js';

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
