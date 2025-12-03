import { embed, embedMany } from 'ai';
import { google } from '@ai-sdk/google';
import fs from 'fs/promises';
import path from 'path';
import { createFileCache, computeHash, type Cache } from './cache.js';
import {
  generateContextBatch,
  createContextualChunkWithoutLLM,
  type ContextualChunk,
} from './context.js';
import { createBM25Index, mergeSearchResults, type BM25Index } from './bm25.js';
import { rerankWithFallback } from './rerank.js';
import { createDefaultRegistry, type StrategyRegistry, type Chunk } from './strategies/index.js';
import { logger } from '@agent/shared';

export type { ContextualChunk } from './context.js';
export type { Chunk, ChunkingStrategy, ChunkMetadata } from './strategies/index.js';

export interface EmbeddedChunk extends ContextualChunk {
  id: string;
  embedding: number[];
}

interface CachedFileData {
  chunks: EmbeddedChunk[];
  hash: string;
}

export interface CodebaseRAG {
  indexCodebase: () => Promise<void>;
  searchCodebase: (query: string, topK?: number) => Promise<EmbeddedChunk[]>;
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
  onProgress?: (message: string) => void;
  strategyRegistry?: StrategyRegistry;
}

export function createCodebaseRAG(
  workspaceRoot: string,
  options: RAGOptions = {}
): CodebaseRAG {
  const {
    enableCache = true,
    enableContextGeneration = true,
    enableBM25 = true,
    enableReranking = true,
    rerankTopN = 100,
    returnTopN = 20,
    onProgress,
    strategyRegistry,
  } = options;

  const registry = strategyRegistry ?? createDefaultRegistry();

  let embeddedChunks: EmbeddedChunk[] = [];
  let bm25Index: BM25Index | null = null;
  const chunkMap = new Map<string, EmbeddedChunk>();

  const cache: Cache<CachedFileData> = createFileCache(
    path.join(workspaceRoot, '.rag-cache')
  );

  const log = (message: string) => {
    onProgress?.(message);
  };

  const scanWorkspace = async (): Promise<Chunk[]> => {
    log('Scanning workspace...');
    return await scanWorkspaceFallback();
  };

  const scanWorkspaceFallback = async (): Promise<Chunk[]> => {
    const chunks: Chunk[] = [];

    // Directories to exclude from indexing (matches common .gitignore patterns)
    const excludedDirs = new Set([
      'node_modules',
      'dist',
      '.git',
      'build',
      '.rag-cache',
      'workspace.rag-cache',
      'logs',
      '.turbo',
      'coverage',
      '.next',
      '.nuxt',
      'out',
      'tests/temp',
    ]);

    // File patterns to exclude
    const excludedFilePatterns = [
      /\.log$/,
      /\.db$/,
      /\.db-shm$/,
      /\.db-wal$/,
      /\.tsbuildinfo$/,
    ];

    const shouldExcludeFile = (filename: string): boolean => {
      return excludedFilePatterns.some(pattern => pattern.test(filename));
    };

    const scanDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip excluded directories
        if (entry.isDirectory() && excludedDirs.has(entry.name)) {
          continue;
        }

        // Skip excluded file patterns
        if (entry.isFile() && shouldExcludeFile(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const strategy = registry.getStrategy(fullPath);
          if (strategy) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const fileChunks = await registry.chunkFile(content, fullPath);
              chunks.push(...fileChunks);
            } catch (error) {
              log(`Failed to chunk file ${fullPath}: ${error}`);
            }
          }
        }
      }
    };

    await scanDir(workspaceRoot);
    return chunks;
  };

  const processChunks = async (chunks: Chunk[]): Promise<EmbeddedChunk[]> => {
    log(`Processing ${chunks.length} chunks...`);

    let contextualChunks: ContextualChunk[];
    if (enableContextGeneration) {
      log('Generating contextual descriptions...');
      contextualChunks = await generateContextBatch(chunks, {
        concurrency: 5,
        delayMs: 200,
        onProgress: (completed, total) => {
          log(`Context generation: ${completed}/${total}`);
        },
      });
    } else {
      contextualChunks = chunks.map(createContextualChunkWithoutLLM);
    }

    log('Generating embeddings...');
    const { embeddings: vectors } = await embedMany({
      model: google.embedding('text-embedding-004') as any,
      values: contextualChunks.map((c) => c.contextualContent),
    });

    return contextualChunks.map((chunk, index) => ({
      ...chunk,
      id: `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`,
      embedding: vectors[index],
    }));
  };

  const buildBM25Index = (chunks: EmbeddedChunk[]): BM25Index => {
    log('Building BM25 index...');
    const index = createBM25Index();

    for (const chunk of chunks) {
      index.addDocument({
        id: chunk.id,
        content: chunk.contextualContent,
        name: chunk.metadata.name,
        filePath: chunk.filePath,
      });
    }

    index.consolidate();
    return index;
  };

  return {
    indexCodebase: async () => {
      const startTime = performance.now();
      logger.info('⏱️  [RAG] Starting codebase indexing');

      const chunks = await scanWorkspace();

      if (chunks.length === 0) {
        log('No code files found to index');
        embeddedChunks = [];
        bm25Index = null;
        const duration = performance.now() - startTime;
        logger.info('⏱️  [RAG] Indexing completed (empty)', {
          durationMs: duration.toFixed(2),
        });
        return;
      }

      const fileChunksMap = new Map<string, Chunk[]>();
      for (const chunk of chunks) {
        if (!fileChunksMap.has(chunk.filePath)) {
          fileChunksMap.set(chunk.filePath, []);
        }
        const fileChunks = fileChunksMap.get(chunk.filePath);
        if (fileChunks) {
          fileChunks.push(chunk);
        }
      }

      const allEmbedded: EmbeddedChunk[] = [];

      for (const [filePath, fileChunks] of fileChunksMap.entries()) {
        const fileContent = fileChunks.map((c) => c.content).join('\n');
        const fileHash = computeHash(fileContent);

        let processed: EmbeddedChunk[];

        if (enableCache && (await cache.isValid(filePath, fileHash))) {
          const cached = await cache.get(filePath);
          if (cached) {
            processed = cached.chunks;
            log(`Cache hit: ${filePath}`);
          } else {
            processed = await processChunks(fileChunks);
            await cache.set(filePath, { chunks: processed, hash: fileHash }, fileHash);
          }
        } else {
          processed = await processChunks(fileChunks);
          if (enableCache) {
            await cache.set(filePath, { chunks: processed, hash: fileHash }, fileHash);
          }
        }

        allEmbedded.push(...processed);
      }

      embeddedChunks = allEmbedded;
      chunkMap.clear();
      for (const chunk of embeddedChunks) {
        chunkMap.set(chunk.id, chunk);
      }

      if (enableBM25) {
        bm25Index = buildBM25Index(embeddedChunks);
      }

      const duration = performance.now() - startTime;
      log(`Indexed ${embeddedChunks.length} chunks from ${fileChunksMap.size} files`);
      logger.info('⏱️  [RAG] Indexing completed', {
        chunks: embeddedChunks.length,
        files: fileChunksMap.size,
        durationMs: duration.toFixed(2),
        durationSec: (duration / 1000).toFixed(3),
      });
    },

    searchCodebase: async (query: string, topK?: number) => {
      const startTime = performance.now();
      logger.debug('⏱️  [RAG] Starting search', { query });

      const finalTopK = topK ?? returnTopN;

      if (embeddedChunks.length === 0) {
        logger.debug('⏱️  [RAG] Search completed (no chunks)');
        return [];
      }

      const embeddingStartTime = performance.now();
      const { embedding: queryEmbedding } = await embed({
        model: google.embedding('text-embedding-004') as any,
        value: query,
      });
      const embeddingDuration = performance.now() - embeddingStartTime;
      logger.debug('⏱️  [RAG] Query embedding generated', {
        durationMs: embeddingDuration.toFixed(2),
      });

      const embeddingResults = embeddedChunks
        .map((chunk) => ({
          id: chunk.id,
          score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, rerankTopN)
        .map((r, i) => ({ ...r, rank: i + 1 }));

      let candidateIds: string[];

      if (enableBM25 && bm25Index) {
        const bm25Results = bm25Index.search(query, rerankTopN);
        const merged = mergeSearchResults(embeddingResults, bm25Results);
        candidateIds = merged.slice(0, rerankTopN).map((r) => r.id);
      } else {
        candidateIds = embeddingResults.map((r) => r.id);
      }

      let finalIds: string[];

      if (enableReranking && candidateIds.length > 0) {
        const docsToRerank = candidateIds
          .map((id) => chunkMap.get(id))
          .filter((c): c is EmbeddedChunk => c !== undefined)
          .map((c) => ({ id: c.id, content: c.contextualContent }));

        const reranked = await rerankWithFallback(query, docsToRerank, {
          topN: finalTopK,
        });
        finalIds = reranked.map((r) => r.id);
      } else {
        finalIds = candidateIds.slice(0, finalTopK);
      }

      const results = finalIds
        .map((id) => chunkMap.get(id))
        .filter((c): c is EmbeddedChunk => c !== undefined);

      const duration = performance.now() - startTime;
      logger.info('⏱️  [RAG] Search completed', {
        query,
        results: results.length,
        durationMs: duration.toFixed(2),
        durationSec: (duration / 1000).toFixed(3),
      });

      return results;
    },

    getStats: () => ({
      totalChunks: embeddedChunks.length,
      files: new Set(embeddedChunks.map((e) => e.filePath)).size,
    }),

    clearCache: async () => {
      await cache.clear();
    },

    dispose: () => {
      registry.dispose();
      embeddedChunks = [];
      bm25Index = null;
      chunkMap.clear();
    },
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
