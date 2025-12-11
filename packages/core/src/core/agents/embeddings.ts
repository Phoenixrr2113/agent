import { openai } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider-v2';
import { logger } from '@agent/shared';
import type { EmbeddingModel } from 'ai';

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
