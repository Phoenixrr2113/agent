import path from 'path';
import { logger } from '@agent/shared';
import { createFileCache, computeHash, type Cache } from './cache.js';
import { createBM25Index, type BM25Index } from './bm25.js';
import { createDefaultRegistry, Chunk } from './strategies/index.js';
import {
  CodebaseRAG,
  RAGOptions,
  CachedFileData,
  EmbeddedChunk,
  SearchOptions
} from './types.js';
import { scanWorkspace } from './workspace-scanner.js';
import { processChunks } from './chunk-processor.js';
import { executeSearch } from './search-engine.js';

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
    returnTopN = 8,
    maxTokensPerSearch = 3000,
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

      const chunks = await scanWorkspace(workspaceRoot, registry, log);

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
            processed = await processChunks(fileChunks, enableContextGeneration, log);
            await cache.set(filePath, { chunks: processed, hash: fileHash }, fileHash);
          }
        } else {
          processed = await processChunks(fileChunks, enableContextGeneration, log);
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

    searchCodebase: async (query: string, options?: SearchOptions) => {
      return executeSearch(
        query,
        options,
        {
          embeddedChunks,
          bm25Index,
          chunkMap
        },
        {
          returnTopN,
          maxTokensPerSearch,
          rerankTopN,
          enableBM25,
          enableReranking
        }
      );
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
