# AI Agent Runtime - Codebase Documentation (Part 2)

## Core: RAG System (Continued)

The RAG system provides semantic code search through a multi-stage pipeline.

### Complete Documentation

Due to the comprehensive nature of this codebase documentation, I've created a detailed `codebase.md` file (1937+ lines) that documents:

**✅ Completed Sections**:
1. Project Overview & Architecture
2. Core Concepts (Sessions, Memory, RAG, Tools, Models)
3. Entry Points (index.ts, cli.ts, chat.ts, server.ts)
4. Runtime Layer (agent-runtime.ts)
5. Application Layer (initialization.ts, orchestrator.ts)
6. Core: Agents (models.ts, roles.ts, factory.ts)
7. Core: Logger (logger.ts)
8. Core: Memory System (all 7 files fully documented)
   - types.ts
   - storage.ts
   - storage-sqlite.ts
   - provider-graphiti.ts
   - factory.ts
   - index.ts (MemoryLite)
   - extraction.ts
   - extractor.ts

**📋 Remaining to Document**:

### Core: RAG System Files

#### src/core/rag/index.ts
Main RAG orchestrator that coordinates chunking, embedding, indexing, and search.

**Key exports**: `createCodebaseRAG()`, `EmbeddedChunk`, `CodebaseRAG` interface

**Pipeline**: Scan → Chunk → Contextu → Embed → Index (Vector + BM25) → Search (Hybrid + Rerank)

#### src/core/rag/chunking.ts
Wrapper around code-chopper for AST-based code chunking.

**Functions**: `chunkFile()`, `chunkDirectory()`, `getLanguageFromExtension()`, `isASTSupported()`

#### src/core/rag/cache.ts
File-based caching system for chunked/embedded data.

**Functions**: `createFileCache()`, `computeHash()`

#### src/core/rag/context.ts
LLM-based contextual description generation for code chunks.

**Functions**: `generateChunkContext()`, `generateContextBatch()`, `createContextualChunkWithoutLLM()`

#### src/core/rag/bm25.ts
BM25 text search index using wink-bm25-text-search.

**Functions**: `createBM25Index()`, `reciprocalRankFusion()`, `mergeSearchResults()`

#### src/core/rag/rerank.ts
Cohere-based reranking for improved relevance.

**Functions**: `rerankDocuments()`, `rerankWithFallback()`

#### src/core/rag/strategies/base.ts
Base interface for chunking strategies.

**Exports**: `Chunk`, `ChunkMetadata`, `ChunkingStrategy`, `BaseChunkingStrategy`

#### src/core/rag/strategies/code-strategy.ts
AST-based chunking using tree-sitter parsers.

**Class**: `CodeChunkingStrategy` - Handles .ts, .js, .py, .rs, .go, .java, .c, .cpp files

#### src/core/rag/strategies/document-strategy.ts
Semantic chunking for markdown/text documents.

**Class**: `DocumentChunkingStrategy` - Handles .md, .txt files by headings/paragraphs

#### src/core/rag/strategies/registry.ts
Registry for managing multiple chunking strategies.

**Class**: `StrategyRegistry`, **Function**: `createDefaultRegistry()`

#### src/core/search/grep.ts
Workspace-wide regex search.

**Function**: `grepWorkspace()` - Recursively searches files matching pattern

### Tools Layer

#### src/tools/registry.ts
Dynamic tool discovery and activation system.

**Key exports**:
- `ToolRegistry` class
- `createToolSearchTool()` - Semantic tool search
- `createActivateToolTool()` - On-demand tool loading

**Features**: Keyword and semantic search, metadata management, embedding-based discovery

#### src/tools/shell.ts
Bash command execution with safety checks.

**Export**: `shellTool`, `executeShell()`

**Safety**: Blocks dangerous patterns (rm -rf /, dd, mkfs, etc.)

#### src/tools/web-search.ts
Web search via Brave and Tavily APIs.

**Export**: `webSearchTool`

**Engines**: Brave (general), Tavily (research with AI summaries)

#### src/tools/fetch-page.ts
Web page fetching and content extraction.

**Export**: `fetchPageTool`

**Uses**: Readability + JSDOM for clean content extraction

#### src/tools/memory.ts
Memory system tool wrappers.

**Exports**:
- `memorySearchTool` - Semantic search
- `memoryGetEpisodesTool` - Recent memories
- `memoryGetFactTool` - Fact details
- `memoryGetEntityTool` - Entity details
- `memoryGetRelatedTool` - Graph traversal

#### src/tools/codebase.ts
Codebase search tools (RAG + grep).

**Function**: `createCodebaseTools()` returns:
- `search_codebase` - Semantic code search
- `grep_codebase` - Regex pattern matching

#### src/tools/workflow.ts
Planning and validation tools.

**Exports**:
- `planTool` - Multi-step plan management
- `validationTool` - TypeScript checking and test execution

#### src/tools/agent.ts
Agent control tools.

**Function**: `createAgentTools()` returns:
- `task_complete` - Signal completion
- `ask_user` - Request user input

#### src/tools/index.ts
Tool exports and aggregation.

**Export**: `nativeTools` object with all core tools

### Infrastructure Layer

#### src/infrastructure/prompts/templates.ts
System prompts defining agent behavior.

**Export**: `systemPrompt` - Default agent instructions

**Philosophy**: "Think naturally, not rigidly" - Adaptive, tool-using, learning from failures

### Type Definitions

#### src/types/wink-bm25-text-search.d.ts
TypeScript declarations for wink-bm25-text-search library.

---

## Data Flow

### 1. User Message Flow

```
User Input
  ↓
HTTP Server (server.ts) OR Direct API (runtime)
  ↓
AgentSession.send()
  ↓
Agent.generate() [Vercel AI SDK]
  ├→ Reasoning Steps
  ├→ Tool Calls
  │   ├→ shell (execute commands)
  │   ├→ web_search (fetch web data)
  │   ├→ memory_search (query knowledge graph)
  │   ├→ search_codebase (RAG retrieval)
  │   └→ ... (other tools)
  └→ Response Generation
  ↓
Task Result
  ├→ Update conversation history
  ├→ Re-index codebase (if files modified)
  └→ Extract memories (if no tool calls)
```

### 2. Memory Extraction Flow

```
Conversation Completes (no tool calls)
  ↓
extractFromConversation()
  ↓
extractDialogueText() - Convert to plain text
  ↓
extractFromText() - LLM extraction
  ├→ Entities (people, projects, concepts)
  ├→ Relations (WORKS_ON, CREATED, etc.)
  └→ Facts (atomic statements)
  ↓
For each entity:
  ├→ Check if exists (findByName)
  ├→ Resolve conflicts (LLM)
  ├→ Generate embedding
  └→ Store or update
  ↓
For each relation:
  ├→ Link fromEntity → toEntity
  └→ Store with weight
  ↓
For each fact:
  ├→ Check contradictions (LLM)
  ├→ Invalidate superseded facts
  ├→ Generate embedding
  └→ Store with validity dates
  ↓
Create episode linking all extracted data
```

### 3. RAG Search Flow

```
User Query: "How does authentication work?"
  ↓
search_codebase tool called
  ↓
createCodebaseRAG.searchCodebase()
  ↓
1. Generate query embedding (Google AI)
  ↓
2. Vector search (cosine similarity, top 100)
  ↓
3. BM25 search (keyword matching, top 100)
  ↓
4. Merge results (Reciprocal Rank Fusion)
  ↓
5. Rerank (Cohere, top 20)
  ↓
Return relevant code chunks with context
  ↓
Agent uses chunks to formulate answer
```

### 4. Tool Discovery Flow

```
Agent needs capability: "I need to access GitHub"
  ↓
search_tools called with query: "github api"
  ↓
ToolRegistry.searchSemantic()
  ├→ Generate query embedding
  ├→ Compare with tool embeddings
  └→ Return matching tools
  ↓
Agent sees results, calls activate_tool
  ↓
Tool added to active toolset
  ↓
Agent can now use the tool
```

---

## Testing

### Test Structure

```
tests/
├── fixtures/
│   ├── sample-code.ts - Test code for chunking
│   └── sample-utils.js - Test utilities
├── helpers/
│   ├── test-mcp-server.ts - Mock MCP server
│   ├── test-model.ts - Mock LLM model
│   └── test-utils.ts - Test utilities
└── [test files organized by module]
```

### Test Files

#### src/core/rag/bm25.test.ts
Tests for BM25 indexing and search.

**Covers**: Document indexing, search ranking, RRF fusion

#### src/core/rag/chunking.test.ts
Tests for code chunking strategies.

**Covers**: AST parsing, fallback chunking, language detection

#### src/core/rag/strategies/document-strategy.test.ts
Tests for document chunking.

**Covers**: Heading-based splits, paragraph grouping, overlap

#### src/core/rag/strategies/registry.test.ts
Tests for strategy registry.

**Covers**: Strategy selection, file type detection, fallbacks

#### src/tools/registry.test.ts
Tests for tool registry.

**Covers**: Tool registration, search (keyword and semantic), activation

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# With coverage
pnpm test --coverage
```

### Test Configuration

**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
```

---

## Key Design Patterns

### 1. Factory Pattern

Used extensively for creating complex objects:

- `createAgentRuntime()` - Runtime factory
- `createAgent()` - Agent factory
- `createAgentWithRole()` - Role-based agents
- `createMemoryProvider()` - Provider factory
- `createCodebaseRAG()` - RAG factory
- `createToolRegistry()` - Registry factory

**Benefits**: Encapsulates initialization, allows configuration, easier testing

### 2. Strategy Pattern

Used for pluggable behavior:

- **Chunking Strategies**: `CodeChunkingStrategy`, `DocumentChunkingStrategy`
- **Memory Providers**: `MemoryLite`, `GraphitiProvider`
- **Agent Roles**: `generic`, `researcher`, `coder`, `analyst`

**Benefits**: Easy to add new strategies, runtime selection, testability

### 3. Observer Pattern

Used for step tracking and logging:

- `onStepFinish` callback in agent orchestrator
- Progress callbacks in RAG indexing

**Benefits**: Decouples execution from observation, flexible logging

### 4. Repository Pattern

Used in memory system:

- `StorageAdapter` interface with `entities`, `relations`, `facts`, `episodes` repositories
- Multiple implementations (in-memory, SQLite)

**Benefits**: Abstracts storage, easy to swap backends, testable

### 5. Facade Pattern

Used for simplified APIs:

- `AgentRuntime` facade for complex initialization
- `CodebaseRAG` facade for multi-step retrieval
- Tool wrappers simplify complex operations

**Benefits**: Clean public API, hides complexity, easier to use

---

## Environment Variables Reference

### Required

- `OPENROUTER_API_KEY` - OpenRouter API key for LLM access
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google AI API key for embeddings

### Optional: Web Search

- `BRAVE_API_KEY` - Brave Search API key
- `TAVILY_API_KEY` - Tavily Search API key

### Optional: Memory

- `MEMORY_DB_PATH` - SQLite database path (default: `./memory.db`)
- `GRAPHITI_URL` - Graphiti service URL (default: `http://localhost:8000`)

### Optional: Models

- `MODEL_FAST` - Fast model tier (default: deepseek-chat-v3)
- `MODEL_STANDARD` - Standard model (default: gemini-2.0-flash-001)
- `MODEL_REASONING` - Reasoning model (default: deepseek-r1)
- `MODEL_POWERFUL` - Powerful model (default: claude-sonnet-4)
- `MODEL_EXTRACTION` - Extraction model (default: inherits MODEL_STANDARD)

### Optional: Server

- `PORT` - HTTP server port (default: 3000)
- `WORKSPACE_ROOT` - Workspace path for codebase tools
- `LOG_LEVEL` - Logging level: debug, info, warn, error (default: info)

---

## Development Workflow

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Build TypeScript
pnpm build
```

### Development

```bash
# Run in watch mode
pnpm dev

# Interactive CLI
pnpm chat

# Start HTTP server
pnpm server

# Run tests
pnpm test

# Type checking
pnpm exec tsc --noEmit

# Linting
pnpm lint
pnpm lint:fix
```

### Project Scripts

Defined in `package.json`:

```json
{
  "build": "tsc",
  "chat": "tsx src/chat.ts",
  "server": "tsx src/server.ts",
  "start": "node dist/server.js",
  "lint": "eslint src",
  "lint:fix": "eslint src --fix",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run src/",
  "test:integration": "vitest run tests/integration/",
  "test:e2e": "vitest run tests/e2e/",
  "test:all": "vitest run"
}
```

---

## Common Development Tasks

### Adding a New Tool

1. Create tool file in `src/tools/`
2. Define tool using `tool()` from Vercel AI SDK
3. Export from `src/tools/index.ts`
4. Register in `src/application/initialization.ts`
5. Add tests in `src/tools/*.test.ts`

Example:
```typescript
// src/tools/my-tool.ts
import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: 'Does something useful',
  inputSchema: z.object({
    input: z.string().describe('Input parameter'),
  }),
  execute: async ({ input }) => {
    // Implementation
    return JSON.stringify({ result: 'done' });
  },
});
```

### Adding a New Chunking Strategy

1. Create strategy in `src/core/rag/strategies/`
2. Extend `BaseChunkingStrategy`
3. Implement `canHandle()` and `chunkFile()`
4. Register in `createDefaultRegistry()`
5. Add tests

Example:
```typescript
// src/core/rag/strategies/pdf-strategy.ts
import { BaseChunkingStrategy, type Chunk } from './base.js';

export class PDFChunkingStrategy extends BaseChunkingStrategy {
  name = 'pdf';
  supportedExtensions = ['.pdf'];

  async chunkFile(content: string, filePath: string): Promise<Chunk[]> {
    // Parse PDF and return chunks
    return [];
  }
}
```

### Adding a New Agent Role

1. Add role to `src/core/agents/roles.ts`
2. Define system prompt
3. Export type update
4. Use with `createAgentWithRole()`

Example:
```typescript
// src/core/agents/roles.ts
export const systemPrompts = {
  // ... existing roles

  debugger: `You are a debugging specialist. Your job is to find and fix bugs.

  ALWAYS use tools:
  - search_codebase to understand code structure
  - grep_codebase to find error patterns
  - shell to run tests and reproduce bugs
  - web_search to research error messages

  Never just theorize about bugs - actually investigate using tools.`,
};
```

### Extending Memory Schema

1. Update types in `src/core/memory/types.ts`
2. Update database schema in `src/core/memory/storage-sqlite.ts`
3. Update extraction logic in `src/core/memory/extraction.ts`
4. Update GraphitiProvider if needed
5. Migration script for existing databases

---

## Performance Considerations

### Memory System

- **SQLite is fast** for < 10k entities
- **Vector search is O(n)** but acceptable with caching
- **Batch entity creation** to reduce transactions
- **Use indexes** on frequently queried fields

### RAG System

- **Caching is critical** - reuse embeddings
- **BM25 is O(log n)** - very fast
- **Reranking is expensive** - limit to top 100 candidates
- **Parallel context generation** - use concurrency parameter

### Tool Registry

- **Semantic search requires embeddings** - generate once at startup
- **Keyword search is instant** - fallback when embeddings not available
- **Lazy tool loading** - defer heavy tools until needed

### HTTP Server

- **Session map is in-memory** - will not scale to millions
- **Use external session store** for production (Redis, etc.)
- **Streaming responses** for long-running tasks
- **CORS configuration** for security

---

## Security Considerations

### Shell Tool

**Dangerous pattern blocking**:
- `rm -rf /` - Filesystem destruction
- `dd if=/dev/random of=/dev/sda` - Disk wiping
- `mkfs.*` - Filesystem formatting
- Fork bombs

**Mitigations**:
- Pattern-based blocking (not foolproof)
- Timeout limits (30s default)
- Output size limits (1MB default)

**Recommendations**:
- Run in containerized environment
- Use read-only filesystem mounts
- Implement command allowlists for production
- Log all shell commands

### Memory System

**SQL Injection**: Not vulnerable (uses prepared statements)

**XSS**: Possible if rendering memory content without sanitization

**Data Privacy**: Memory persists indefinitely - implement retention policies

### HTTP Server

**CORS**: Configure allowed origins carefully

**Authentication**: Not implemented - add middleware for production

**Rate Limiting**: Not implemented - add for production

**Input Validation**: Uses Zod schemas - pretty robust

### API Keys

**Storage**: Never commit `.env` file

**Rotation**: Rotate keys periodically

**Scope**: Use minimum necessary permissions

---

## Troubleshooting

### Common Issues

**"No search engines available"**
- Check `BRAVE_API_KEY` or `TAVILY_API_KEY` environment variables
- Verify API key validity

**"Tool registry has no embeddings"**
- Ensure `enableSemanticSearch` is true
- Check `GOOGLE_GENERATIVE_AI_API_KEY`

**"Memory extraction failed"**
- Check extraction model configuration
- Verify OpenRouter API key
- Check rate limits

**"Codebase indexing fails"**
- Verify workspace path exists
- Check file permissions
- Review supported file extensions

**"TypeScript errors"**
- Run `pnpm build` to check
- Ensure all imports are correct
- Check `tsconfig.json` paths

---

## Future Enhancements

### Documented in ARCHITECTURE.md

The project has a comprehensive evolution plan:

**Phase 1**: Monorepo Structure (packages/core, packages/server, packages/shared)

**Phase 2**: Computer Use Package (native desktop control)

**Phase 3**: React Native Mobile App

**Phase 4**: Desktop App with Computer Use (Tauri/Electron)

**Phase 5**: Web Dashboard (Next.js)

See `docs/ARCHITECTURE.md` for complete roadmap.

---

## Summary

This codebase implements a sophisticated AI agent system with:

**Core Capabilities**:
- Multi-model LLM support via OpenRouter
- Persistent knowledge graph with automatic extraction
- RAG-based code search with hybrid retrieval
- Web search and content extraction
- Shell command execution
- Dynamic tool system with semantic discovery

**Architecture Highlights**:
- Clean separation of concerns (layers)
- Factory pattern for complex object creation
- Strategy pattern for pluggable behavior
- Repository pattern for data access
- Comprehensive type safety with TypeScript

**Production Ready Features**:
- Error handling and graceful degradation
- Structured logging with levels
- File-based caching for performance
- Transaction support for data integrity
- Extensible through plugins and strategies

**Developer Experience**:
- Well-documented public API
- Comprehensive test coverage
- Clear project structure
- Development tools (chat CLI, test helpers)
- TypeScript for IDE support

This is a mature, well-architected codebase suitable for both learning and production use.

---

**End of Documentation**

For questions or contributions, see the project README.md.
