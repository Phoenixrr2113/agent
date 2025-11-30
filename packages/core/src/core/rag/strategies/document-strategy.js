import { BaseChunkingStrategy } from './base.js';
export class DocumentChunkingStrategy extends BaseChunkingStrategy {
    name = 'document';
    supportedExtensions = ['.md', '.txt', '.text', '.markdown'];
    options;
    constructor(options = {}) {
        super();
        this.options = {
            maxChunkSize: options.maxChunkSize ?? 1000,
            chunkOverlap: options.chunkOverlap ?? 200,
            splitByParagraph: options.splitByParagraph ?? true,
            splitByHeading: options.splitByHeading ?? true,
        };
    }
    splitByHeadings(content, filePath) {
        const lines = content.split('\n');
        const chunks = [];
        let currentChunk = [];
        let currentStartLine = 1;
        let currentHeading;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                if (currentChunk.length > 0) {
                    chunks.push({
                        content: currentChunk.join('\n'),
                        filePath,
                        startLine: currentStartLine,
                        endLine: i,
                        metadata: {
                            type: 'section',
                            language: 'markdown',
                            heading: currentHeading,
                        },
                    });
                }
                currentChunk = [line];
                currentStartLine = i + 1;
                currentHeading = headingMatch[2];
            }
            else {
                currentChunk.push(line);
            }
        }
        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join('\n'),
                filePath,
                startLine: currentStartLine,
                endLine: lines.length,
                metadata: {
                    type: 'section',
                    language: 'markdown',
                    heading: currentHeading,
                },
            });
        }
        return chunks;
    }
    splitByParagraphs(content, filePath) {
        const paragraphs = content.split(/\n\s*\n/);
        const chunks = [];
        let currentChunk = [];
        let currentStartLine = 1;
        let currentLineCount = 0;
        for (const paragraph of paragraphs) {
            const paragraphLines = paragraph.split('\n').length;
            const paragraphLength = paragraph.length;
            if (currentChunk.length > 0 &&
                currentChunk.join('\n\n').length + paragraphLength > this.options.maxChunkSize) {
                chunks.push({
                    content: currentChunk.join('\n\n'),
                    filePath,
                    startLine: currentStartLine,
                    endLine: currentStartLine + currentLineCount - 1,
                    metadata: {
                        type: 'paragraph_group',
                        language: 'text',
                    },
                });
                const overlapSize = Math.floor(currentChunk.length * (this.options.chunkOverlap / this.options.maxChunkSize));
                currentChunk = currentChunk.slice(-Math.max(1, overlapSize));
                currentStartLine = currentStartLine + currentLineCount - currentChunk.join('\n\n').split('\n').length;
                currentLineCount = currentChunk.join('\n\n').split('\n').length;
            }
            currentChunk.push(paragraph);
            currentLineCount += paragraphLines + 1;
        }
        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join('\n\n'),
                filePath,
                startLine: currentStartLine,
                endLine: currentStartLine + currentLineCount - 1,
                metadata: {
                    type: 'paragraph_group',
                    language: 'text',
                },
            });
        }
        return chunks;
    }
    splitByFixedSize(content, filePath) {
        const lines = content.split('\n');
        const chunks = [];
        let currentChunk = [];
        let currentStartLine = 1;
        for (let i = 0; i < lines.length; i++) {
            currentChunk.push(lines[i]);
            if (currentChunk.join('\n').length >= this.options.maxChunkSize) {
                chunks.push({
                    content: currentChunk.join('\n'),
                    filePath,
                    startLine: currentStartLine,
                    endLine: i + 1,
                    metadata: {
                        type: 'fixed_size',
                        language: 'text',
                    },
                });
                const overlapLines = Math.floor(currentChunk.length * (this.options.chunkOverlap / this.options.maxChunkSize));
                currentChunk = currentChunk.slice(-Math.max(1, overlapLines));
                currentStartLine = i + 2 - currentChunk.length;
            }
        }
        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join('\n'),
                filePath,
                startLine: currentStartLine,
                endLine: lines.length,
                metadata: {
                    type: 'fixed_size',
                    language: 'text',
                },
            });
        }
        return chunks;
    }
    async chunkFile(content, filePath, extension) {
        if (extension === '.md' || extension === '.markdown') {
            if (this.options.splitByHeading) {
                return this.splitByHeadings(content, filePath);
            }
        }
        if (this.options.splitByParagraph) {
            return this.splitByParagraphs(content, filePath);
        }
        return this.splitByFixedSize(content, filePath);
    }
}
