import { embed, embedMany, type EmbeddingModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider-v2';
import { logger } from '@agent/shared';

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

export function getEmbeddingModel(modelOverride?: string): EmbeddingModel {
  if (process.env.OLLAMA_ENABLED === 'true') {
    const modelName = modelOverride || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
    logger.info('🔌 Using Ollama embedding model', { model: modelName });
    return ollama.textEmbeddingModel(modelName);
  }
  const modelName = modelOverride || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  logger.info('🔌 Using OpenAI embedding model', { model: modelName });
  return openai.embedding(modelName);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    logger.warn('Cosine similarity called with empty embedding vector');
    return 0;
  }

  if (a.length !== b.length) {
    logger.warn('Embedding dimension mismatch - vectors have different lengths', {
      lengthA: a.length,
      lengthB: b.length,
    });
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
  model: EmbeddingModel;
}

export function createEmbeddingService(modelOverride?: string): EmbeddingService {
  const model = getEmbeddingModel(modelOverride);

  return {
    model,

    async embed(text: string): Promise<number[]> {
      const startTime = performance.now();
      const result = await embed({ model, value: text });
      const duration = performance.now() - startTime;
      logger.debug('⏱️  [embedding] Generated embedding', {
        durationMs: duration.toFixed(2),
        textLength: text.length,
      });
      return result.embedding;
    },

    async embedMany(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      const startTime = performance.now();
      const result = await embedMany({ model, values: texts });
      const duration = performance.now() - startTime;
      logger.debug('⏱️  [embedding] Generated embeddings batch', {
        durationMs: duration.toFixed(2),
        count: texts.length,
        avgLength: Math.round(texts.reduce((sum, t) => sum + t.length, 0) / texts.length),
      });
      return result.embeddings;
    },

    cosineSimilarity,
  };
}
