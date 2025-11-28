# RAG Improvement Plan

## Overview

Implement Anthropic's Contextual Retrieval approach to dramatically improve RAG quality. Based on their research, this can reduce retrieval failures by up to 67%.

## Current State

- **Chunking**: Line-based (adaptive/semantic by line count)
- **Search**: Embedding-only (Google text-embedding-004)
- **Ranking**: Single-pass cosine similarity
- **Problem**: Chunks lose context, exact keyword matches missed

## Target State

- **Chunking**: AST-based semantic chunks (functions, classes, methods)
- **Context**: LLM-generated descriptions prepended to each chunk
- **Search**: Hybrid (Embeddings + BM25)
- **Ranking**: Reranking with Cohere rerank-v3.5

## Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `code-chopper` | AST-based code chunking via tree-sitter | `pnpm add code-chopper` |
| `@ai-sdk/cohere` | Reranking model provider | `pnpm add @ai-sdk/cohere` |
| `wink-bm25-text-search` | BM25 lexical search | `pnpm add wink-bm25-text-search` |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     INDEXING PIPELINE                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Scan workspace files                                        │
│  2. code-chopper → Parse into AST chunks                        │
│  3. Gemini Flash → Generate context for each chunk              │
│  4. Prepend context + Embed (text-embedding-004)                │
│  5. Build BM25 index from chunk content                         │
│  6. Cache embeddings + BM25 index                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     SEARCH PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Query arrives                                               │
│  2. Parallel: Embed query + BM25 search                         │
│  3. Reciprocal Rank Fusion (RRF) → Merge results                │
│  4. Rerank top 100 with Cohere                                  │
│  5. Return top 20 chunks                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Tasks

### Phase 1: AST Chunking ✅
- [x] Replace `chunking.ts` with code-chopper integration
- [x] Map code-chopper output to existing `CodeChunk` interface
- [x] Handle unsupported file types (fallback to current chunking)
- [x] Update tests

### Phase 2: Contextual Embeddings ✅
- [x] Create context generation function using Gemini Flash
- [x] Design prompt for code context generation
- [x] Integrate into indexing pipeline
- [x] Cache generated contexts alongside embeddings

### Phase 3: Hybrid Search (BM25 + Embeddings) ✅
- [x] Add BM25 index building during indexing
- [x] Implement parallel search (embedding + BM25)
- [x] Implement Reciprocal Rank Fusion (RRF)
- [x] Update cache to store BM25 index

### Phase 4: Reranking ✅
- [x] Add Cohere provider configuration
- [x] Integrate rerank() into search pipeline
- [x] Make reranking optional (for cost control)

### Phase 5: Integration & Testing ✅
- [x] Update `createCodebaseRAG()` API
- [x] Write unit tests for bm25 and chunking
- [ ] Write integration tests (optional - manual test passed)
- [ ] Performance benchmarking
- [x] Update exports
- [x] Upgrade to AI SDK v6 beta for rerank support

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/core/rag/chunking.ts` | Rewrite | Use code-chopper for AST parsing |
| `src/core/rag/context.ts` | Create | LLM context generation |
| `src/core/rag/bm25.ts` | Create | BM25 index wrapper |
| `src/core/rag/rerank.ts` | Create | Reranking integration |
| `src/core/rag/hybrid.ts` | Create | RRF and hybrid search |
| `src/core/rag/index.ts` | Update | Wire everything together |
| `src/core/rag/cache.ts` | Update | Cache BM25 index + contexts |

## Context Generation Prompt

```
You are analyzing a code chunk for a retrieval system.
Given the following code from {filePath}, inside {parentScope}:

{code}

Write a brief description (2-3 sentences) explaining:
1. What this code does
2. Its purpose in the codebase
3. Key functions/classes/variables it defines or uses

Be concise and technical. Focus on searchability.
```

## Reciprocal Rank Fusion Algorithm

```typescript
function reciprocalRankFusion(
  rankings: Map<string, number>[],  // docId -> rank
  k: number = 60
): Map<string, number> {
  const scores = new Map<string, number>();
  
  for (const ranking of rankings) {
    for (const [docId, rank] of ranking) {
      const current = scores.get(docId) || 0;
      scores.set(docId, current + 1 / (k + rank));
    }
  }
  
  return scores;
}
```

## Configuration Options

```typescript
interface RAGOptions {
  enableContextGeneration?: boolean;  // default: true
  enableBM25?: boolean;               // default: true
  enableReranking?: boolean;          // default: true
  rerankTopN?: number;                // default: 100
  returnTopN?: number;                // default: 20
  contextModel?: string;              // default: 'gemini-2.0-flash'
  rerankModel?: string;               // default: 'rerank-v3.5'
}
```

## Success Metrics

- Retrieval accuracy improvement (manual testing)
- Indexing time (should be < 2x current)
- Search latency (should be < 500ms for reranked results)
- Cache hit rate maintained

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| code-chopper native deps | Falls back to current chunking if unavailable |
| Cohere API costs | Reranking is optional, can disable |
| Slow indexing | Context generation is parallelized, cached |
| Gemini rate limits | Batch requests, respect 15 RPM limit |

