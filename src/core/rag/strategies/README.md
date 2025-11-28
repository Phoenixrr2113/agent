# RAG Chunking Strategies

This directory contains pluggable chunking strategies for the RAG system. The architecture allows you to easily add new strategies for different file types.

## Architecture

The RAG system uses a **Strategy Pattern** to handle different file types:

- **Base Strategy Interface** (`base.ts`) - Defines the contract for all chunking strategies
- **Strategy Registry** (`registry.ts`) - Manages and selects strategies based on file type
- **Built-in Strategies**:
  - `CodeChunkingStrategy` - AST-based chunking for code files
  - `DocumentChunkingStrategy` - Semantic chunking for text/markdown files

## Usage

### Using the Default Registry

```typescript
import { createCodebaseRAG } from '../index.js';

const rag = createCodebaseRAG('/path/to/workspace');
await rag.indexCodebase();
```

The default registry automatically:
- Uses `CodeChunkingStrategy` for `.ts`, `.js`, `.py`, `.java`, `.go`, `.rs`, `.c`, `.cpp`, `.h`
- Uses `DocumentChunkingStrategy` for `.md`, `.txt`, `.text`, `.markdown`
- Falls back to `DocumentChunkingStrategy` for unknown file types

### Custom Strategy Registry

```typescript
import { createCodebaseRAG } from '../index.js';
import { StrategyRegistry, CodeChunkingStrategy, DocumentChunkingStrategy } from './strategies/index.js';

const registry = new StrategyRegistry();
registry.register(new CodeChunkingStrategy());
registry.register(new DocumentChunkingStrategy({ maxChunkSize: 500 }));

const rag = createCodebaseRAG('/path/to/workspace', {
  strategyRegistry: registry,
});
```

## Creating a Custom Strategy

To add support for a new file type, create a class that extends `BaseChunkingStrategy`:

```typescript
import { BaseChunkingStrategy, type Chunk } from './base.js';

export class PDFChunkingStrategy extends BaseChunkingStrategy {
  name = 'pdf';
  supportedExtensions = ['.pdf'];

  async chunkFile(content: string, filePath: string, extension: string): Promise<Chunk[]> {
    return [{
      content: parsedContent,
      filePath,
      startLine: 1,
      endLine: pageCount,
      metadata: {
        type: 'pdf_page',
        language: 'pdf',
        pageNumber: 1,
      },
    }];
  }
}
```

Then register it:

```typescript
const registry = createDefaultRegistry();
registry.register(new PDFChunkingStrategy());
```

## Strategy Selection

The registry selects strategies based on file extension:

1. Iterates through registered strategies
2. Calls `strategy.canHandle(filePath, extension)` for each
3. Returns the first matching strategy
4. Falls back to the default strategy if no match

## Built-in Strategies

### CodeChunkingStrategy

Uses AST parsing via `code-chopper` to intelligently chunk code by:
- Functions
- Classes
- Methods
- Modules

Falls back to brace-depth-based chunking if AST parsing fails.

### DocumentChunkingStrategy

Chunks text/markdown files by:
- **Headings** (for markdown) - splits on `#` headers
- **Paragraphs** - splits on double newlines
- **Fixed size** - splits by character count with overlap

Options:
```typescript
new DocumentChunkingStrategy({
  maxChunkSize: 1000,
  chunkOverlap: 200,
  splitByParagraph: true,
  splitByHeading: true,
})
```

## Testing

Each strategy should have comprehensive tests:

```bash
pnpm test src/core/rag/strategies
```

