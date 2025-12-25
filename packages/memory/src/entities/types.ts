export interface Entity {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Relation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  weight: number;
  attributes: Record<string, unknown>;
  createdAt: Date;
}

export interface Fact {
  id: string;
  content: string;
  embedding: number[];
  entityIds: string[];
  relationIds: string[];
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
  source: string;
  confidence: number;
}

export interface Episode {
  id: string;
  groupId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  factIds: string[];
  entityIds: string[];
  timestamp: Date;
  lastProcessedMessageIndex: number;
}

export interface SearchResult {
  facts: Fact[];
  entities: Entity[];
  relations: Relation[];
  score: number;
}

export interface MemoryAddInput {
  content: string;
  role?: 'user' | 'assistant' | 'system';
  groupId?: string;
  source?: string;
  lastProcessedMessageIndex?: number;
}

export interface MemorySearchInput {
  query: string;
  groupIds?: string[];
  maxResults?: number;
  includeExpired?: boolean;
}

export interface MemoryProvider {
  add(input: MemoryAddInput): Promise<{ factIds: string[]; entityIds: string[] }>;
  search(input: MemorySearchInput): Promise<SearchResult>;
  getEpisodes(groupId: string, limit?: number): Promise<Episode[]>;
  getFact(factId: string): Promise<Fact | null>;
  getEntity(entityId: string): Promise<Entity | null>;
  getRelatedEntities(entityId: string, depth?: number): Promise<Entity[]>;
  invalidateFact(factId: string): Promise<void>;
  close(): Promise<void>;
}

export interface ExtractionResult {
  entities: Array<{
    name: string;
    type: string;
    attributes: Record<string, unknown>;
  }>;
  relations: Array<{
    fromEntity: string;
    toEntity: string;
    type: string;
    weight?: number;
  }>;
  facts: Array<{
    content: string;
    entityNames: string[];
    confidence: number;
  }>;
}

export interface LiteMemoryConfig {
  provider: 'lite';
  embeddingModel?: string;
  extractionModel?: string;
  storagePath?: string;
}

export interface GraphitiMemoryConfig {
  provider: 'graphiti';
  graphitiUrl?: string;
}

export type MemoryConfig = LiteMemoryConfig | GraphitiMemoryConfig;

export interface MemoryConfigInput {
  embeddingModel?: string;
  extractionModel?: string;
  storagePath?: string;
  graphitiUrl?: string;
}
