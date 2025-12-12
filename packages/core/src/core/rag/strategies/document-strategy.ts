import { BaseChunkingStrategy, type Chunk } from './base.js';

export interface DocumentChunkingOptions {
  maxChunkSize?: number;
  chunkOverlap?: number;
  splitByParagraph?: boolean;
  splitByHeading?: boolean;
}

export class DocumentChunkingStrategy extends BaseChunkingStrategy {
  name = 'document';
  supportedExtensions = ['.md', '.txt', '.text', '.markdown'];

  private options: Required<DocumentChunkingOptions>;

  constructor(options: DocumentChunkingOptions = {}) {
    super();

    const maxChunkSize = options.maxChunkSize ?? 1000;
    if (maxChunkSize < 100 || maxChunkSize > 100000) {
      throw new Error(`maxChunkSize must be between 100 and 100000, got ${maxChunkSize}`);
    }

    const chunkOverlap = options.chunkOverlap ?? 200;
    if (chunkOverlap < 0 || chunkOverlap >= maxChunkSize) {
      throw new Error(`chunkOverlap must be between 0 and maxChunkSize, got ${chunkOverlap}`);
    }

    this.options = {
      maxChunkSize,
      chunkOverlap,
      splitByParagraph: options.splitByParagraph ?? true,
      splitByHeading: options.splitByHeading ?? true,
    };
  }

  private splitByHeadings(content: string, filePath: string): Chunk[] {
    const lines = content.split('\n');
    const chunks: Chunk[] = [];
    let currentChunk: string[] = [];
    let currentStartLine = 1;
    let currentHeading: string | undefined;

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
      } else {
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

  private splitByParagraphs(content: string, filePath: string): Chunk[] {
    const paragraphs = content.split(/\n\s*\n/);
    const chunks: Chunk[] = [];
    let currentChunk: string[] = [];
    let currentStartLine = 1;
    let currentLineCount = 0;

    for (const paragraph of paragraphs) {
      const paragraphLines = paragraph.split('\n').length;
      const paragraphLength = paragraph.length;

      if (
        currentChunk.length > 0 &&
        currentChunk.join('\n\n').length + paragraphLength > this.options.maxChunkSize
      ) {
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

  private splitByFixedSize(content: string, filePath: string): Chunk[] {
    const lines = content.split('\n');
    const chunks: Chunk[] = [];
    let currentChunk: string[] = [];
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

  async chunkFile(content: string, filePath: string, extension: string): Promise<Chunk[]> {
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

