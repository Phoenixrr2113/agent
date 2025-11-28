import { CodeChunkingStrategy } from './strategies/code-strategy.js';
import type { Chunk, ChunkMetadata } from './strategies/base.js';

export type CodeChunk = Chunk;
export type { ChunkMetadata };
export type ChunkingStrategy = 'ast' | 'fixed' | 'adaptive';

const codeStrategy = new CodeChunkingStrategy();

export function disposeParserFactory(): void {
  codeStrategy.dispose();
}

export function getLanguageFromExtension(ext: string): string | null {
  return codeStrategy.getLanguageFromExtension(ext);
}

export function isASTSupported(ext: string): boolean {
  return codeStrategy.canHandle('', ext);
}

export async function chunkDirectory(
  directoryPath: string,
  options: { excludeDirs?: RegExp[] } = {}
): Promise<CodeChunk[]> {
  return codeStrategy.chunkDirectory(directoryPath, options);
}

export async function chunkFile(
  content: string,
  filePath: string,
  extension: string
): Promise<CodeChunk[]> {
  return codeStrategy.chunkFile(content, filePath, extension);
}
