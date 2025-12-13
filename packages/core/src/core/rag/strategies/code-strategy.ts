import { logger } from '@agent/shared';
import {
  createParserFactory,
  readDirectoryAndChunk,
  parseCodeAndChunk,
  type BoundaryChunk,
  type ParserFactory,
} from 'code-chopper';

import { BaseChunkingStrategy, type Chunk } from './base.js';

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'golang',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
};

export class CodeChunkingStrategy extends BaseChunkingStrategy {
  name = 'code';
  supportedExtensions = Object.keys(LANGUAGE_MAP);
  private parserFactory: ParserFactory | null = null;

  private async getParserFactory(): Promise<ParserFactory> {
    if (!this.parserFactory) {
      this.parserFactory = createParserFactory();
    }
    return this.parserFactory;
  }

  dispose(): void {
    if (this.parserFactory) {
      this.parserFactory.dispose();
      this.parserFactory = null;
    }
  }

  getLanguageFromExtension(extension: string): string | null {
    return LANGUAGE_MAP[extension.toLowerCase()] || null;
  }

  private boundaryChunkToChunk(bc: BoundaryChunk, filePath?: string): Chunk {
    return {
      content: bc.content,
      filePath: filePath || bc.filePath || '',
      startLine: bc.start.row + 1,
      endLine: bc.end.row + 1,
      metadata: {
        name: bc.boundary.name,
        type: bc.boundary.type,
        parent: bc.boundary.parent,
        docs: bc.boundary.docs,
        language: bc.language,
      },
    };
  }

  private chunkFallback(content: string, filePath: string): Chunk[] {
    const lines = content.split('\n');
    const chunks: Chunk[] = [];
    const maxLines = 100;
    let currentChunk: string[] = [];
    let currentStartLine = 1;
    let braceDepth = 0;

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (currentChunk.length >= maxLines) {
        // ... previous logic ...
      } else if (line !== undefined) {
        currentChunk.push(line);
      }

      for (const char of (line || '')) {
        if (char === '{' || char === '[' || char === '(') braceDepth++;
        if (char === '}' || char === ']' || char === ')') braceDepth--;
      }

      const shouldSplit =
        currentChunk.length >= maxLines && braceDepth === 0 && (line || '').trim().length === 0;

      if (shouldSplit) {
        chunks.push({
          content: currentChunk.join('\n'),
          filePath,
          startLine: currentStartLine,
          endLine: index + 1,
          metadata: { type: 'block', language: 'unknown' },
        });
        currentChunk = [];
        currentStartLine = index + 2;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        filePath,
        startLine: currentStartLine,
        endLine: lines.length,
        metadata: { type: 'block', language: 'unknown' },
      });
    }

    return chunks;
  }

  async chunkFile(content: string, filePath: string, extension: string): Promise<Chunk[]> {
    const language = this.getLanguageFromExtension(extension);

    if (!language) {
      return this.chunkFallback(content, filePath);
    }

    try {
      const factory = await this.getParserFactory();
      const boundaryChunks = await parseCodeAndChunk(content, language as any, factory, {});

      const chunks = boundaryChunks.map((chunk) => ({
        ...this.boundaryChunkToChunk(chunk),
        filePath,
      }));

      if (chunks.length === 0) {
        return this.chunkFallback(content, filePath);
      }

      return chunks;
    } catch (error) {
      logger.warn('AST parsing failed, falling back to simple chunking', {
        filePath,
        error: String(error),
      });
      return this.chunkFallback(content, filePath);
    }
  }

  override async chunkDirectory(directoryPath: string, options: { excludeDirs?: RegExp[] } = {}): Promise<Chunk[]> {
    const factory = await this.getParserFactory();
    const excludeDirectories = options.excludeDirs || [/node_modules/, /\.git/, /dist/, /build/];

    const boundaryChunks = await readDirectoryAndChunk(factory, { excludeDirs: excludeDirectories }, directoryPath);
    return boundaryChunks.map((bc) => this.boundaryChunkToChunk(bc, bc.filePath));
  }
}

