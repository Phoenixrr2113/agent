import { randomUUID } from 'crypto';
import type {
  MemoryAddInput,
  MemorySearchInput,
  SearchResult,
  Fact,
  Entity,
  Episode,
} from './types.js';
import {
  BaseMemoryProvider,
  normalizeEntity,
  normalizeFact,
  normalizeEpisode,
} from './provider-base.js';

class GraphitiProvider extends BaseMemoryProvider {
  constructor(private graphitiUrl: string) {
    super();
  }

  private async request(path: string, method: string, body?: unknown) {
    const response = await fetch(`${this.graphitiUrl}${path}`, {
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

  async add(input: MemoryAddInput) {
    const result = await this.request('/messages', 'POST', {
      group_id: input.groupId || 'default',
      messages: [{
        uuid: randomUUID(),
        content: input.content,
        role: input.role || 'user',
        role_type: input.role || 'user',
        name: `memory_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source_description: input.source || 'agent_memory',
      }],
    });

    const addResult = {
      factIds: result.facts?.map((f: any) => f.uuid) || [],
      entityIds: result.entities?.map((e: any) => e.uuid) || [],
    };

    this.validateAddResult(addResult);
    return addResult;
  }

  async search(input: MemorySearchInput): Promise<SearchResult> {
    const result = await this.request('/search', 'POST', {
      query: input.query,
      group_ids: input.groupIds,
      max_facts: input.maxResults || 10,
    });

    const facts: Fact[] = (result.facts || []).map((f: any) =>
      normalizeFact({
        id: f.uuid,
        content: f.fact || f.content,
        embedding: [],
        entityIds: f.entity_ids || [],
        relationIds: f.relation_ids || [],
        validFrom: new Date(f.valid_at || f.created_at),
        validTo: f.invalid_at ? new Date(f.invalid_at) : null,
        createdAt: new Date(f.created_at),
        source: f.source_description || 'graphiti',
        confidence: f.confidence ?? 1.0,
      })
    );

    const entities: Entity[] = (result.entities || []).map((e: any) =>
      normalizeEntity({
        id: e.uuid,
        name: e.name,
        type: e.entity_type || 'unknown',
        attributes: e.attributes || {},
        embedding: e.embedding,
        createdAt: new Date(e.created_at || Date.now()),
        updatedAt: new Date(e.updated_at || Date.now()),
      })
    );

    const searchResult = {
      facts,
      entities,
      relations: [],
      score: result.score ?? 1.0,
    };

    return this.validateSearchResult(searchResult);
  }

  async getEpisodes(groupId: string, limit = 10): Promise<Episode[]> {
    const result = await this.request(`/episodes/${groupId}?last_n=${limit}`, 'GET');

    const episodes = (result.episodes || result || []).map((e: any) =>
      normalizeEpisode({
        id: e.uuid,
        groupId: e.group_id || groupId,
        content: e.content,
        role: e.role || 'user',
        factIds: e.fact_ids || [],
        entityIds: e.entity_ids || [],
        timestamp: new Date(e.timestamp || e.created_at),
        lastProcessedMessageIndex: e.last_processed_message_index ?? 0,
      })
    );

    return this.validateEpisodes(episodes);
  }

  async getFact(factId: string): Promise<Fact | null> {
    try {
      const result = await this.request(`/entity-edge/${factId}`, 'GET');
      const fact = normalizeFact({
        id: result.uuid,
        content: result.fact || result.content,
        embedding: result.embedding || [],
        entityIds: result.entity_ids || [],
        relationIds: result.relation_ids || [],
        validFrom: new Date(result.valid_at || result.created_at),
        validTo: result.invalid_at ? new Date(result.invalid_at) : null,
        createdAt: new Date(result.created_at),
        source: result.source_description || 'graphiti',
        confidence: result.confidence ?? 1.0,
      });
      return this.validateFact(fact);
    } catch {
      return null;
    }
  }

  async getEntity(entityId: string): Promise<Entity | null> {
    try {
      const result = await this.request(`/entity/${entityId}`, 'GET');
      const entity = normalizeEntity({
        id: result.uuid,
        name: result.name,
        type: result.entity_type || 'unknown',
        attributes: result.attributes || {},
        embedding: result.embedding,
        createdAt: new Date(result.created_at || Date.now()),
        updatedAt: new Date(result.updated_at || Date.now()),
      });
      return this.validateEntity(entity);
    } catch {
      return null;
    }
  }

  async getRelatedEntities(entityId: string, depth = 1): Promise<Entity[]> {
    try {
      const result = await this.request(`/entity/${entityId}/related?depth=${depth}`, 'GET');
      const entities = (result.entities || []).map((e: any) =>
        normalizeEntity({
          id: e.uuid,
          name: e.name,
          type: e.entity_type || 'unknown',
          attributes: e.attributes || {},
          embedding: e.embedding,
          createdAt: new Date(e.created_at || Date.now()),
          updatedAt: new Date(e.updated_at || Date.now()),
        })
      );
      return this.validateEntities(entities);
    } catch {
      return [];
    }
  }

  async invalidateFact(factId: string): Promise<void> {
    await this.request(`/entity-edge/${factId}/invalidate`, 'POST', {
      invalid_at: new Date().toISOString(),
    });
  }

  async close(): Promise<void> {
  }
}

export function createGraphitiProvider(graphitiUrl: string): GraphitiProvider {
  return new GraphitiProvider(graphitiUrl);
}

