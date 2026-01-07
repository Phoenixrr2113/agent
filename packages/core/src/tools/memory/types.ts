import { z } from 'zod';

export const memoryInputSchema = z.object({
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

export type MemoryInput = z.infer<typeof memoryInputSchema>;

export interface MemoryProviderConfig {
  storagePath?: string;
  graphitiUrl?: string;
  embeddingModel?: string;
  extractionModel?: string;
}

export interface FactSummary {
  id: string;
  content: string;
  confidence: number;
  source?: string;
}

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  attributes?: Record<string, unknown>;
}

export interface SearchResult {
  action: 'search';
  query: string;
  factsCount: number;
  entitiesCount: number;
  facts: FactSummary[];
  entities: EntitySummary[];
  relations: unknown[];
}

export interface EpisodesResult {
  action: 'episodes';
  groupId: string;
  count: number;
  episodes: unknown[];
}
