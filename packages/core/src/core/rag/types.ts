import { ContextualChunk } from './context.js';
import { StrategyRegistry, Chunk, ChunkingStrategy, ChunkMetadata } from './strategies/index.js';

export type { ContextualChunk } from './context.js';
export type { Chunk, ChunkingStrategy, ChunkMetadata } from './strategies/index.js';

export interface EmbeddedChunk extends ContextualChunk {
  id: string;
  embedding: number[];
}

export interface CachedFileData {
  chunks: EmbeddedChunk[];
  hash: string;
}

export interface SearchOptions {
  topK?: number;
  maxTokens?: number;
}

export interface CodebaseRAG {
  indexCodebase: () => Promise<void>;
  searchCodebase: (query: string, options?: SearchOptions) => Promise<EmbeddedChunk[]>;
  getStats: () => { totalChunks: number; files: number };
  clearCache: () => Promise<void>;
  dispose: () => void;
}

export interface RAGOptions {
  enableCache?: boolean;
  enableContextGeneration?: boolean;
  enableBM25?: boolean;
  enableReranking?: boolean;
  rerankTopN?: number;
  returnTopN?: number;
  maxTokensPerSearch?: number;
  onProgress?: (message: string) => void;
  strategyRegistry?: StrategyRegistry;
}
