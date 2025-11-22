import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'fs/promises';
import path from 'path';

export interface CodeChunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface EmbeddedChunk extends CodeChunk {
  embedding: number[];
}

export class CodebaseRAG {
  private embeddings: EmbeddedChunk[] = [];
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async indexCodebase(): Promise<void> {
    const chunks = await this.scanWorkspace();

    if (chunks.length === 0) {
      console.log('No code files found to index');
      return;
    }

    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small') as any,
      values: chunks.map(chunk => chunk.content),
    });

    this.embeddings = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));

    console.log(`Indexed ${this.embeddings.length} code chunks`);
  }

  private async scanWorkspace(): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h'];

    async function scanDirectory(dir: string): Promise<void> {
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
            const fileChunks = chunkCode(content, fullPath);
            chunks.push(...fileChunks);
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    }

    await scanDirectory(this.workspaceRoot);
    return chunks;
  }

  async searchCodebase(query: string, topK: number = 5, similarityThreshold: number = 0.3): Promise<EmbeddedChunk[]> {
    if (this.embeddings.length === 0) {
      return [];
    }

    const { embedding: queryEmbedding } = await embedMany({
      model: openai.embedding('text-embedding-3-small') as any,
      values: [query],
    }).then(result => ({ embedding: result.embeddings[0] }));

    const similarities = this.embeddings.map(chunk => ({
      chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    return similarities
      .filter(item => item.similarity >= similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(item => item.chunk);
  }

  getStats() {
    return {
      totalChunks: this.embeddings.length,
      files: new Set(this.embeddings.map(e => e.filePath)).size,
    };
  }
}

function chunkCode(content: string, filePath: string, chunkSize: number = 100): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunkLines = lines.slice(i, i + chunkSize);
    const chunkContent = chunkLines.join('\n');

    if (chunkContent.trim().length > 0) {
      chunks.push({
        content: chunkContent,
        filePath,
        startLine: i + 1,
        endLine: Math.min(i + chunkSize, lines.length),
      });
    }
  }

  return chunks;
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
