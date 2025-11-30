import path from 'path';
import { CodeChunkingStrategy } from './code-strategy.js';
import { DocumentChunkingStrategy } from './document-strategy.js';
export class StrategyRegistry {
    strategies = [];
    defaultStrategy = null;
    register(strategy) {
        this.strategies.push(strategy);
    }
    setDefault(strategy) {
        this.defaultStrategy = strategy;
    }
    getStrategy(filePath) {
        const extension = path.extname(filePath).toLowerCase();
        for (const strategy of this.strategies) {
            if (strategy.canHandle(filePath, extension)) {
                return strategy;
            }
        }
        return this.defaultStrategy;
    }
    async chunkFile(content, filePath) {
        const strategy = this.getStrategy(filePath);
        if (!strategy) {
            throw new Error(`No chunking strategy found for file: ${filePath}`);
        }
        const extension = path.extname(filePath).toLowerCase();
        return strategy.chunkFile(content, filePath, extension);
    }
    dispose() {
        for (const strategy of this.strategies) {
            if ('dispose' in strategy && typeof strategy.dispose === 'function') {
                strategy.dispose();
            }
        }
    }
}
export function createDefaultRegistry() {
    const registry = new StrategyRegistry();
    const codeStrategy = new CodeChunkingStrategy();
    const documentStrategy = new DocumentChunkingStrategy();
    registry.register(codeStrategy);
    registry.register(documentStrategy);
    registry.setDefault(documentStrategy);
    return registry;
}
