import { embedMany } from 'ai';
import {
  generateContextBatch,
  createContextualChunkWithoutLLM,
  ContextualChunk,
} from './context.js';
import { Chunk } from './strategies/index.js';
import { EmbeddedChunk } from './types.js';
// Using consolidated embeddings module
import { getEmbeddingModel } from '../embeddings/index.js';

export async function processChunks(
  chunks: Chunk[],
  enableContextGeneration: boolean,
  log: (message: string) => void
): Promise<EmbeddedChunk[]> {
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
    model: getEmbeddingModel(),
    values: contextualChunks.map((c) => c.contextualContent),
  });

  return contextualChunks.map((chunk, index) => ({
    ...chunk,
    id: `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`,
    embedding: vectors[index],
  }));
}
