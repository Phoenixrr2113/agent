import { openai } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider-v2';
import { logger } from '@agent/shared';
import type { EmbeddingModel } from 'ai';

const OLLAMA_ENABLED = process.env.OLLAMA_ENABLED === 'true';

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

export function getEmbeddingModel(): EmbeddingModel {
  if (OLLAMA_ENABLED) {
    logger.info('🔌 Using Ollama embedding model', { model: OLLAMA_EMBEDDING_MODEL });
    return ollama.textEmbeddingModel(OLLAMA_EMBEDDING_MODEL);
  }
  logger.info('🔌 Using OpenAI embedding model', { model: OPENAI_EMBEDDING_MODEL });
  return openai.embedding(OPENAI_EMBEDDING_MODEL);
}
