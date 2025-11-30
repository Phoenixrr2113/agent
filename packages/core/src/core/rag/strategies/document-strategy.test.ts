import { describe, it, expect } from 'vitest';
import { DocumentChunkingStrategy } from './document-strategy.js';

describe('DocumentChunkingStrategy', () => {
  it('should chunk markdown by headings', async () => {
    const strategy = new DocumentChunkingStrategy({ splitByHeading: true });
    const content = `# Introduction
This is the intro.

## Section 1
Content for section 1.

## Section 2
Content for section 2.`;

    const chunks = await strategy.chunkFile(content, 'test.md', '.md');

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.type).toBe('section');
    expect(chunks[0].metadata.language).toBe('markdown');
  });

  it('should chunk text by paragraphs', async () => {
    const strategy = new DocumentChunkingStrategy({ splitByParagraph: true });
    const content = `First paragraph.

Second paragraph.

Third paragraph.`;

    const chunks = await strategy.chunkFile(content, 'test.txt', '.txt');

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.type).toBe('paragraph_group');
  });

  it('should chunk by fixed size when content is large', async () => {
    const strategy = new DocumentChunkingStrategy({ 
      maxChunkSize: 100,
      splitByParagraph: true,
    });
    
    const longParagraph = 'a'.repeat(200);
    const content = `${longParagraph}\n\n${longParagraph}`;

    const chunks = await strategy.chunkFile(content, 'test.txt', '.txt');

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should support .txt extension', () => {
    const strategy = new DocumentChunkingStrategy();
    expect(strategy.canHandle('test.txt', '.txt')).toBe(true);
  });

  it('should support .md extension', () => {
    const strategy = new DocumentChunkingStrategy();
    expect(strategy.canHandle('test.md', '.md')).toBe(true);
  });

  it('should not support .ts extension', () => {
    const strategy = new DocumentChunkingStrategy();
    expect(strategy.canHandle('test.ts', '.ts')).toBe(false);
  });
});

