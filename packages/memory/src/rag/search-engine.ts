import { logger } from '@agent/shared';
import { embed } from 'ai';

import { mergeSearchResults, type BM25Index } from './bm25.js';
import { expandQuery, combineExpandedResults, type QueryExpansionConfig } from './query-expansion.js';
import { rerankWithFallback } from './rerank.js';
import { filterChunksToFitBudget, countTokens } from './tokens.js';
import { type EmbeddedChunk, type SearchOptions } from './types.js';
import { getEmbeddingModel, cosineSimilarity } from "../embeddings/index.js";

export interface SearchState {
  embeddedChunks: EmbeddedChunk[];
  bm25Index: BM25Index | null;
  chunkMap: Map<string, EmbeddedChunk>;
}

export interface SearchConfig {
  returnTopN: number;
  maxTokensPerSearch: number;
  rerankTopN: number;
  enableBM25: boolean;
  enableReranking: boolean;
  enableQueryExpansion?: boolean;
  queryExpansionConfig?: QueryExpansionConfig;
}

async function searchSingleQuery(
  query: string,
  state: SearchState,
  config: SearchConfig
): Promise<Array<{ id: string; score: number }>> {
  const { embedding: queryEmbedding } = await embed({
    model: getEmbeddingModel(),
    value: query,
  });

  const embeddingResults = state.embeddedChunks
    .map((chunk) => ({
      id: chunk.id,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.rerankTopN)
    .map((r, index) => ({ ...r, rank: index + 1 }));

  if (config.enableBM25 && state.bm25Index) {
    const bm25Results = state.bm25Index.search(query, config.rerankTopN);
    return mergeSearchResults(embeddingResults, bm25Results).slice(0, config.rerankTopN);
  }

  return embeddingResults;
}

export async function executeSearch(
  query: string,
  options: SearchOptions | undefined,
  state: SearchState,
  config: SearchConfig
): Promise<EmbeddedChunk[]> {
  const startTime = performance.now();
  logger.debug('⏱️  [RAG] Starting search', { query, options });

  const finalTopK = options?.topK ?? config.returnTopN;
  const maxTokens = options?.maxTokens ?? config.maxTokensPerSearch;

  if (state.embeddedChunks.length === 0) {
    logger.debug('⏱️  [RAG] Search completed (no chunks)');
    return [];
  }

  let allQueries = [query];

  if (config.enableQueryExpansion) {
    const expanded = await expandQuery(query, config.queryExpansionConfig);
    allQueries = [query, ...expanded.expanded];
    logger.debug('⏱️  [RAG] Using expanded queries', { 
      original: query, 
      expanded: expanded.expanded,
      keywords: expanded.keywords,
    });
  }

  const embeddingStartTime = performance.now();
  
  const resultsByQuery = new Map<string, Array<{ id: string; score: number }>>();
  
  const searchPromises = allQueries.map(async (q) => {
    const results = await searchSingleQuery(q, state, config);
    resultsByQuery.set(q, results);
  });
  
  await Promise.all(searchPromises);

  const embeddingDuration = performance.now() - embeddingStartTime;
  logger.debug('⏱️  [RAG] All query embeddings and searches completed', {
    durationMs: embeddingDuration.toFixed(2),
    queryCount: allQueries.length,
  });

  const mergedResults = combineExpandedResults(resultsByQuery, query);
  const candidateIds = mergedResults.slice(0, config.rerankTopN).map(r => r.id);

  let finalIds: string[];

  if (config.enableReranking && candidateIds.length > 0) {
    const docsToRerank = candidateIds
      .map((id) => state.chunkMap.get(id))
      .filter((c): c is EmbeddedChunk => c !== undefined)
      .map((c) => ({ id: c.id, content: c.contextualContent }));

    const reranked = await rerankWithFallback(query, docsToRerank, {
      topN: finalTopK,
    });
    finalIds = reranked.map((r) => r.id);
  } else {
    finalIds = candidateIds.slice(0, finalTopK);
  }

  let results = finalIds
    .map((id) => state.chunkMap.get(id))
    .filter((c): c is EmbeddedChunk => c !== undefined);

  if (maxTokens !== undefined && maxTokens > 0) {
    const originalCount = results.length;
    results = filterChunksToFitBudget(results, maxTokens);
    if (results.length < originalCount) {
      logger.info('⏱️  [RAG] Filtered chunks to fit token budget', {
        original: originalCount,
        filtered: results.length,
        budgetTokens: maxTokens,
        usedTokens: results.reduce((sum, c) => sum + countTokens(c.contextualContent), 0),
      });
    }
  }

  const duration = performance.now() - startTime;
  logger.info('⏱️  [RAG] Search completed', {
    query,
    queriesUsed: allQueries.length,
    results: results.length,
    durationMs: duration.toFixed(2),
    durationSec: (duration / 1000).toFixed(3),
  });

  return results;
}

