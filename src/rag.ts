import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'fs/promises';
import path from 'path';
import { chunkCode, ChunkingStrategy } from './chunking.js';
import { createFileCache, computeHash, Cache } from './cache.js';

interface CodeChunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

interface EmbeddedChunk extends CodeChunk {
  embedding: number[];
}

interface FileEmbeddings {
  chunks: EmbeddedChunk[];
  hash: string;
}

export interface CodebaseRAG {
  indexCodebase: () => Promise<void>;
  searchCodebase: (query: string, topK?: number, similarityThreshold?: number) => Promise<EmbeddedChunk[]>;
  getStats: () => { totalChunks: number; files: number };
  clearCache: () => Promise<void>;
}

export interface RAGOptions {
  chunkingStrategy?: ChunkingStrategy;
  chunkSize?: number;
  enableCache?: boolean;
}

export function createCodebaseRAG(
  workspaceRoot: string,
  options: RAGOptions = {}
): CodebaseRAG {
  const {
    chunkingStrategy = 'adaptive',
    chunkSize = 100,
    enableCache = true,
  } = options;

  let embeddings: EmbeddedChunk[] = [];
  const cache: Cache<FileEmbeddings> = createFileCache(
    path.join(workspaceRoot, '.rag-cache')
  );

  const scanWorkspace = async (): Promise<CodeChunk[]> => {
    const chunks: CodeChunk[] = [];
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h'];

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && codeExtensions.some(ext => entry.name.endsWith(ext))) {
            const content = await fs.readFile(fullPath, 'utf-8');
            const fileChunks = chunkCode(content, chunkSize, chunkingStrategy).map(chunk => ({
              ...chunk,
              filePath: fullPath,
            }));
            chunks.push(...fileChunks);
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    };

    await scanDirectory(workspaceRoot);
    return chunks;
  };

  const groupChunksByFile = (chunks: CodeChunk[]): Map<string, CodeChunk[]> => {
    const fileMap = new Map<string, CodeChunk[]>();
    for (const chunk of chunks) {
      if (!fileMap.has(chunk.filePath)) {
        fileMap.set(chunk.filePath, []);
      }
      fileMap.get(chunk.filePath)!.push(chunk);
    }
    return fileMap;
  };

  const embedChunks = async (chunks: CodeChunk[]): Promise<EmbeddedChunk[]> => {
    if (chunks.length === 0) return [];

    const { embeddings: embeddingVectors } = await embedMany({
      model: openai.embedding('text-embedding-3-small') as any,
      values: chunks.map(chunk => chunk.content),
    });

    return chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddingVectors[index],
    }));
  };

  return {
    indexCodebase: async () => {
      const chunks = await scanWorkspace();

      if (chunks.length === 0) {
        console.log('No code files found to index');
        embeddings = [];
        return;
      }

      const fileChunksMap = groupChunksByFile(chunks);
      const allEmbeddedChunks: EmbeddedChunk[] = [];

      for (const [filePath, fileChunks] of fileChunksMap.entries()) {
        const fileContent = fileChunks.map(c => c.content).join('\n');
        const fileHash = computeHash(fileContent);

        let embeddedChunks: EmbeddedChunk[];

        if (enableCache && await cache.isValid(filePath, fileHash)) {
          const cached = await cache.get(filePath);
          if (cached) {
            embeddedChunks = cached.chunks;
          } else {
            embeddedChunks = await embedChunks(fileChunks);
            await cache.set(filePath, { chunks: embeddedChunks, hash: fileHash }, fileHash);
          }
        } else {
          embeddedChunks = await embedChunks(fileChunks);
          if (enableCache) {
            await cache.set(filePath, { chunks: embeddedChunks, hash: fileHash }, fileHash);
          }
        }

        allEmbeddedChunks.push(...embeddedChunks);
      }

      embeddings = allEmbeddedChunks;
      console.log(`Indexed ${embeddings.length} code chunks from ${fileChunksMap.size} files`);
    },

    searchCodebase: async (query: string, topK: number = 5, similarityThreshold: number = 0.3) => {
      if (embeddings.length === 0) {
        return [];
      }

      const { embedding: queryEmbedding } = await embedMany({
        model: openai.embedding('text-embedding-3-small') as any,
        values: [query],
      }).then(result => ({ embedding: result.embeddings[0] }));

      const similarities = embeddings.map(chunk => ({
        chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }));

      return similarities
        .filter(item => item.similarity >= similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map(item => item.chunk);
    },

    getStats: () => ({
      totalChunks: embeddings.length,
      files: new Set(embeddings.map(e => e.filePath)).size,
    }),

    clearCache: async () => {
      await cache.clear();
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
