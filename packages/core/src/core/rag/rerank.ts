import { logger } from '@agent/shared';
import { cohere } from '@ai-sdk/cohere';
import { rerank } from 'ai';

export interface RerankDocument {
  id: string;
  content: string;
}

export interface RerankResult {
  id: string;
  score: number;
  rank: number;
}

export interface RerankOptions {
  model?: string;
  topN?: number;
}

export async function rerankDocuments(
  query: string,
  documents: RerankDocument[],
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const { model = 'rerank-v3.5', topN = 20 } = options;

  if (documents.length === 0) {
    return [];
  }

  if (documents.length <= topN) {
    return documents.map((document, index) => ({
      id: document.id,
      score: 1 - index / documents.length,
      rank: index + 1,
    }));
  }

  const { ranking } = await rerank({
    model: cohere.reranking(model),
    query,
    documents: documents.map((document) => document.content),
    topN,
  });

  return ranking.map((result: { originalIndex: number; score: number }, index: number) => ({
    id: documents[result.originalIndex]?.id ?? 'unknown',
    score: result.score,
    rank: index + 1,
  }));
}

export async function rerankWithFallback(
  query: string,
  documents: RerankDocument[],
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  try {
    return await rerankDocuments(query, documents, options);
  } catch (error) {
    logger.warn('Rerank failed, falling back to simple ordering', {
      error: String(error),
      documentCount: documents.length,
      topN: options.topN || 20,
    });
    return documents.slice(0, options.topN || 20).map((document, index) => ({
      id: document.id,
      score: 1 - index / documents.length,
      rank: index + 1,
    }));
  }
}

