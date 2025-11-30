import { createParserFactory, readDirectoryAndChunk, parseCodeAndChunk, } from 'code-chopper';
import { BaseChunkingStrategy } from './base.js';
const LANGUAGE_MAP = {
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
    parserFactory = null;
    async getParserFactory() {
        if (!this.parserFactory) {
            this.parserFactory = createParserFactory();
        }
        return this.parserFactory;
    }
    dispose() {
        if (this.parserFactory) {
            this.parserFactory.dispose();
            this.parserFactory = null;
        }
    }
    getLanguageFromExtension(ext) {
        return LANGUAGE_MAP[ext.toLowerCase()] || null;
    }
    boundaryChunkToChunk(bc, filePath) {
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
    chunkFallback(content, filePath) {
        const lines = content.split('\n');
        const chunks = [];
        const maxLines = 100;
        let currentChunk = [];
        let currentStartLine = 1;
        let braceDepth = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            currentChunk.push(line);
            for (const char of line) {
                if (char === '{' || char === '[' || char === '(')
                    braceDepth++;
                if (char === '}' || char === ']' || char === ')')
                    braceDepth--;
            }
            const shouldSplit = currentChunk.length >= maxLines && braceDepth === 0 && line.trim().length === 0;
            if (shouldSplit) {
                chunks.push({
                    content: currentChunk.join('\n'),
                    filePath,
                    startLine: currentStartLine,
                    endLine: i + 1,
                    metadata: { type: 'block', language: 'unknown' },
                });
                currentChunk = [];
                currentStartLine = i + 2;
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
    async chunkFile(content, filePath, extension) {
        const language = this.getLanguageFromExtension(extension);
        if (!language) {
            return this.chunkFallback(content, filePath);
        }
        try {
            const factory = await this.getParserFactory();
            const boundaryChunks = await parseCodeAndChunk(content, language, factory, {});
            const chunks = boundaryChunks.map((chunk) => ({
                ...this.boundaryChunkToChunk(chunk),
                filePath,
            }));
            if (chunks.length === 0) {
                return this.chunkFallback(content, filePath);
            }
            return chunks;
        }
        catch {
            return this.chunkFallback(content, filePath);
        }
    }
    async chunkDirectory(directoryPath, options = {}) {
        const factory = await this.getParserFactory();
        const excludeDirs = options.excludeDirs || [/node_modules/, /\.git/, /dist/, /build/];
        const boundaryChunks = await readDirectoryAndChunk(factory, { excludeDirs }, directoryPath);
        return boundaryChunks.map((bc) => this.boundaryChunkToChunk(bc, bc.filePath));
    }
}
