import path from 'path';
import type { ChunkingStrategy, Chunk } from './base.js';
import { CodeChunkingStrategy } from './code-strategy.js';
import { DocumentChunkingStrategy } from './document-strategy.js';

export class StrategyRegistry {
  private strategies: ChunkingStrategy[] = [];
  private defaultStrategy: ChunkingStrategy | null = null;

  register(strategy: ChunkingStrategy): void {
    this.strategies.push(strategy);
  }

  setDefault(strategy: ChunkingStrategy): void {
    this.defaultStrategy = strategy;
  }

  getStrategy(filePath: string): ChunkingStrategy | null {
    const extension = path.extname(filePath).toLowerCase();

    for (const strategy of this.strategies) {
      if (strategy.canHandle(filePath, extension)) {
        return strategy;
      }
    }

    return this.defaultStrategy;
  }

  async chunkFile(content: string, filePath: string): Promise<Chunk[]> {
    const strategy = this.getStrategy(filePath);

    if (!strategy) {
      throw new Error(`No chunking strategy found for file: ${filePath}`);
    }

    const extension = path.extname(filePath).toLowerCase();
    return strategy.chunkFile(content, filePath, extension);
  }

  dispose(): void {
    for (const strategy of this.strategies) {
      if ('dispose' in strategy && typeof strategy.dispose === 'function') {
        strategy.dispose();
      }
    }
  }
}

export function createDefaultRegistry(): StrategyRegistry {
  const registry = new StrategyRegistry();

  const codeStrategy = new CodeChunkingStrategy();
  const documentStrategy = new DocumentChunkingStrategy();

  registry.register(codeStrategy);
  registry.register(documentStrategy);

  registry.setDefault(documentStrategy);

  return registry;
}

