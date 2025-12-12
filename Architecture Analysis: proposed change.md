# Architecture Analysis: AI Agent Runtime

## Executive Summary

This document analyzes the architectural patterns, project structure, and design decisions in `packages/core/` against clean architecture principles and modern TypeScript best practices. While the codebase demonstrates solid foundational patterns, there are opportunities to improve modularity, testability, and maintainability.

**Overall Architecture Score: 7/10**

| Category | Score | Notes |
|----------|-------|-------|
| Module Boundaries | 6/10 | Some leaky abstractions, circular dependencies |
| Dependency Management | 5/10 | Heavy reliance on singletons and globals |
| Configuration | 4/10 | Scattered, no centralized system |
| Error Handling | 5/10 | Inconsistent patterns across modules |
| Testability | 6/10 | Good isolation in some areas, gaps in others |
| Separation of Concerns | 7/10 | Generally good, some mixing |
| Scalability | 6/10 | Needs work for horizontal scaling |

---

## Current Architecture Overview

```
packages/core/
├── application/          # Application orchestration layer
│   ├── initialization.ts
│   └── orchestrator.ts
├── core/                 # Core domain logic
│   ├── agents/          # Agent configuration & factories
│   ├── embeddings/      # Embedding services
│   ├── memory/          # Memory providers & storage
│   ├── rag/             # RAG system (chunking, search, rerank)
│   └── tool-instrumentation.ts
├── infrastructure/       # External concerns
│   └── prompts/
├── runtime/             # Runtime execution
│   └── agent-runtime.ts
├── tools/               # Tool implementations
│   ├── background-tasks/
│   ├── filesystem/
│   ├── registry/
│   └── utils/
├── types/               # Type definitions
└── index.ts             # Public API
```

### What's Working Well

1. **Layered Structure**: Clear separation between application, core, infrastructure, and tools
2. **Strategy Pattern in RAG**: Extensible chunking strategies with registry
3. **Provider Abstraction**: Memory system supports multiple backends
4. **Tool Registry**: Dynamic tool discovery and activation

### What Needs Improvement

1. **Dependency Direction**: Some lower layers depend on higher layers
2. **Global State**: Excessive use of module-level singletons
3. **Configuration Sprawl**: Settings scattered across files
4. **Missing Abstractions**: Direct dependencies on concrete implementations

---

## Issue #1: Dependency Inversion Violations

### Current Problem

The codebase has several dependency inversion violations where high-level modules depend on low-level details:

```typescript
// tools/memory.ts - Direct dependency on concrete implementation
import { createAutoMemoryProvider } from '../core/memory/factory.js';

let memoryProviderPromise: Promise<MemoryProvider> | null = null;

function getProvider(): Promise<MemoryProvider> {
  if (!memoryProviderPromise) {
    memoryProviderPromise = createAutoMemoryProvider({
      storagePath: process.env.MEMORY_DB_PATH || './memory.db',
      // ... hardcoded config
    });
  }
  return memoryProviderPromise;
}
```

```typescript
// runtime/agent-runtime.ts - Direct instantiation
import { MemoryExtractor } from '../core/memory/extractor.js';

export class AgentRuntime {
  private memoryExtractor: MemoryExtractor;
  
  constructor() {
    this.memoryExtractor = new MemoryExtractor(/* hardcoded deps */);
  }
}
```

### Recommended Solution

**Implement Dependency Injection Container:**

```typescript
// core/container/types.ts
export const TYPES = {
  MemoryProvider: Symbol.for('MemoryProvider'),
  EmbeddingService: Symbol.for('EmbeddingService'),
  ToolRegistry: Symbol.for('ToolRegistry'),
  Config: Symbol.for('Config'),
  Logger: Symbol.for('Logger'),
} as const;

// core/container/container.ts
import { Container } from 'inversify';

export function createContainer(config: AppConfig): Container {
  const container = new Container();
  
  // Bind abstractions to implementations
  container.bind(TYPES.Config).toConstantValue(config);
  container.bind(TYPES.Logger).to(WinstonLogger).inSingletonScope();
  container.bind(TYPES.MemoryProvider).to(SQLiteMemoryProvider).inSingletonScope();
  container.bind(TYPES.EmbeddingService).to(OpenAIEmbeddingService).inSingletonScope();
  container.bind(TYPES.ToolRegistry).to(ToolRegistry).inSingletonScope();
  
  return container;
}

// runtime/agent-runtime.ts - With DI
@injectable()
export class AgentRuntime {
  constructor(
    @inject(TYPES.MemoryProvider) private memoryProvider: IMemoryProvider,
    @inject(TYPES.EmbeddingService) private embeddingService: IEmbeddingService,
    @inject(TYPES.Config) private config: AppConfig,
  ) {}
}
```

**Alternative: Factory Pattern (No Library)**

```typescript
// core/factories/runtime-factory.ts
export interface RuntimeDependencies {
  memoryProvider: IMemoryProvider;
  embeddingService: IEmbeddingService;
  toolRegistry: IToolRegistry;
  config: AppConfig;
  logger: ILogger;
}

export function createRuntime(deps: RuntimeDependencies): AgentRuntime {
  return new AgentRuntime(deps);
}

// Composition root
export function bootstrap(config: AppConfig): AgentRuntime {
  const logger = createLogger(config.logging);
  const embeddingService = createEmbeddingService(config.embeddings);
  const memoryProvider = createMemoryProvider(config.memory, embeddingService);
  const toolRegistry = createToolRegistry(config.tools);
  
  return createRuntime({
    memoryProvider,
    embeddingService,
    toolRegistry,
    config,
    logger,
  });
}
```

---

## Issue #2: Global Mutable State

### Current Problem

Multiple modules use global mutable state that creates hidden dependencies and makes testing difficult:

```typescript
// tools/memory.ts
let memoryProviderPromise: Promise<MemoryProvider> | null = null;

// tools/workflow.ts
let currentPlan: Plan | null = null;

// tools/sequential-thinking.ts
// Class-level state that persists across requests

// core/rag/bm25.ts
let globalEngine: ReturnType<typeof BM25> | null = null;
let isConsolidated = false;

// core/rag/codebase-rag.ts
let codebaseRAG: any = null;
```

### Recommended Solution

**Convert to Scoped Instances:**

```typescript
// Before: Global singleton
let codebaseRAG: any = null;

export function getCodebaseRAG() {
  if (!codebaseRAG) {
    codebaseRAG = new CodebaseRAG();
  }
  return codebaseRAG;
}

// After: Factory with explicit lifecycle
export class CodebaseRAGFactory {
  constructor(
    private config: RAGConfig,
    private embeddingService: IEmbeddingService,
  ) {}

  create(): CodebaseRAG {
    return new CodebaseRAG(this.config, this.embeddingService);
  }
}

// Usage - scoped to session/request
class AgentSession {
  private codebaseRAG: CodebaseRAG;
  
  constructor(private ragFactory: CodebaseRAGFactory) {
    this.codebaseRAG = ragFactory.create();
  }
  
  async dispose() {
    await this.codebaseRAG.close();
  }
}
```

**Session-Scoped State Pattern:**

```typescript
// core/session/session-context.ts
export interface SessionContext {
  id: string;
  createdAt: Date;
  memoryProvider: IMemoryProvider;
  thinkingEngine: SequentialThinkingEngine;
  currentPlan: Plan | null;
  toolActivations: Set<string>;
}

export class SessionManager {
  private sessions = new Map<string, SessionContext>();

  create(id: string): SessionContext {
    const context: SessionContext = {
      id,
      createdAt: new Date(),
      memoryProvider: this.memoryFactory.create(),
      thinkingEngine: new SequentialThinkingEngine({ maxHistory: 1000 }),
      currentPlan: null,
      toolActivations: new Set(),
    };
    this.sessions.set(id, context);
    return context;
  }

  get(id: string): SessionContext | undefined {
    return this.sessions.get(id);
  }

  async dispose(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      await session.memoryProvider.close();
      this.sessions.delete(id);
    }
  }
}
```

---

## Issue #3: Configuration Scattered Across Codebase

### Current Problem

Configuration is spread across multiple files with no centralized management:

```typescript
// core/agents/models.ts
baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',

// tools/memory.ts
storagePath: process.env.MEMORY_DB_PATH || './memory.db',

// core/memory/factory.ts
const url = config.graphitiUrl || process.env.GRAPHITI_URL || 'http://localhost:8000';

// application/orchestrator.ts
const MAX_CONTEXT_MESSAGES = 50;

// core/rag/codebase-rag.ts
rerankTopN = 100,
returnTopN = 8,
maxTokensPerSearch = 3000,

// tools/background-tasks/task-manager.ts
private maxLogSize = 100 * 1024 * 1024;
private readonly MAX_CONCURRENT_TASKS = 50;
```

### Recommended Solution

**Centralized Configuration System:**

```typescript
// config/schema.ts
import { z } from 'zod';

export const ConfigSchema = z.object({
  // Models
  models: z.object({
    fast: z.object({
      provider: z.enum(['ollama', 'openrouter', 'openai']),
      name: z.string(),
      baseUrl: z.string().url().optional(),
    }),
    reasoning: z.object({
      provider: z.enum(['ollama', 'openrouter', 'openai']),
      name: z.string(),
      baseUrl: z.string().url().optional(),
    }),
  }),

  // Memory
  memory: z.object({
    provider: z.enum(['sqlite', 'graphiti', 'in-memory']),
    storagePath: z.string().default('./data/memory.db'),
    graphitiUrl: z.string().url().optional(),
    checkpointIntervalMs: z.number().default(60000),
  }),

  // RAG
  rag: z.object({
    rerankTopN: z.number().default(100),
    returnTopN: z.number().default(8),
    maxTokensPerSearch: z.number().default(3000),
    cacheDir: z.string().default('./data/cache'),
  }),

  // Background Tasks
  tasks: z.object({
    maxConcurrent: z.number().default(50),
    maxLogSizeMB: z.number().default(100),
    dataDir: z.string().default('./data/tasks'),
  }),

  // Agent
  agent: z.object({
    maxContextMessages: z.number().default(50),
    maxThinkingHistory: z.number().default(1000),
  }),

  // External Services
  services: z.object({
    braveApiKey: z.string().optional(),
    tavilyApiKey: z.string().optional(),
    cohereApiKey: z.string().optional(),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'pretty']).default('pretty'),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

// config/loader.ts
export function loadConfig(): AppConfig {
  const raw = {
    models: {
      fast: {
        provider: process.env.MODEL_FAST_PROVIDER || 'openrouter',
        name: process.env.MODEL_FAST || 'deepseek/deepseek-chat-v3',
        baseUrl: process.env.MODEL_FAST_URL,
      },
      reasoning: {
        provider: process.env.MODEL_REASONING_PROVIDER || 'openrouter',
        name: process.env.MODEL_REASONING || 'anthropic/claude-3.5-sonnet',
        baseUrl: process.env.MODEL_REASONING_URL,
      },
    },
    memory: {
      provider: process.env.MEMORY_PROVIDER || 'sqlite',
      storagePath: process.env.MEMORY_DB_PATH,
      graphitiUrl: process.env.GRAPHITI_URL,
    },
    // ... etc
  };

  return ConfigSchema.parse(raw);
}

// Usage throughout codebase
class TaskManager {
  constructor(private config: AppConfig) {}
  
  get maxConcurrent() {
    return this.config.tasks.maxConcurrent;
  }
}
```

**Environment-Specific Configs:**

```typescript
// config/environments/development.ts
export const developmentConfig: Partial<AppConfig> = {
  logging: { level: 'debug', format: 'pretty' },
  memory: { provider: 'in-memory' },
};

// config/environments/production.ts
export const productionConfig: Partial<AppConfig> = {
  logging: { level: 'info', format: 'json' },
  memory: { provider: 'sqlite' },
};

// config/index.ts
export function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = env === 'production' ? productionConfig : developmentConfig;
  
  return ConfigSchema.parse({
    ...loadFromEnv(),
    ...envConfig,
  });
}
```

---

## Issue #4: Inconsistent Error Handling Architecture

### Current Problem

Three different error handling patterns are used inconsistently:

```typescript
// Pattern 1: JSON string (tools/memory.ts)
try {
  // ...
} catch (error) {
  return JSON.stringify({ error: error.message });
}

// Pattern 2: Utility function (tools/shell.ts)
import { error, success } from './utils/tool-result.js';
return error('Command blocked', { command });

// Pattern 3: Thrown exception (tools/filesystem/*)
throw new Error(`Access denied: ${path}`);
```

### Recommended Solution

**Unified Result Type Pattern:**

```typescript
// core/result/result.ts
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export const Result = {
  ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  },
  
  err<E>(error: E): Result<never, E> {
    return { success: false, error };
  },
  
  isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
    return result.success;
  },
  
  isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return !result.success;
  },
  
  map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    return result.success ? Result.ok(fn(result.data)) : result;
  },
  
  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.success ? result : Result.err(fn(result.error));
  },
  
  unwrap<T, E>(result: Result<T, E>): T {
    if (result.success) return result.data;
    throw result.error;
  },
};

// core/result/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: Record<string, unknown>,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, context);
    this.name = 'ValidationError';
  }
}

export class SecurityError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('SECURITY_ERROR', message, context);
    this.name = 'SecurityError';
  }
}

export class ResourceError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('RESOURCE_ERROR', message, context);
    this.name = 'ResourceError';
  }
}
```

**Updated Tool Pattern:**

```typescript
// tools/types.ts
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
  timing?: {
    durationMs: number;
  };
}

// tools/filesystem/file-operations.ts
export async function readFile(path: string): Promise<ToolResult<string>> {
  try {
    const validPath = await validatePath(path);
    if (!validPath.success) {
      return {
        success: false,
        error: {
          code: 'SECURITY_ERROR',
          message: validPath.error.message,
          context: { path },
        },
      };
    }
    
    const content = await fs.readFile(validPath.data, 'utf-8');
    return { success: true, data: content };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'READ_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        context: { path },
      },
    };
  }
}
```

---

## Issue #5: Missing Interface Segregation

### Current Problem

Large interfaces that force implementations to include unnecessary methods:

```typescript
// core/memory/types.ts
export interface MemoryProvider {
  addEpisode(episode: Episode): Promise<string>;
  addEntity(entity: Entity): Promise<string>;
  addRelationship(relationship: Relationship): Promise<string>;
  addFact(fact: Fact): Promise<string>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getEpisode(id: string): Promise<Episode | null>;
  getEntity(id: string): Promise<Entity | null>;
  // ... 20+ more methods
  close(): Promise<void>;
}
```

### Recommended Solution

**Segregated Interfaces:**

```typescript
// core/memory/interfaces/episode-repository.ts
export interface IEpisodeRepository {
  add(episode: Episode): Promise<string>;
  get(id: string): Promise<Episode | null>;
  findByGroup(groupId: string): Promise<Episode[]>;
  update(id: string, updates: Partial<Episode>): Promise<void>;
  delete(id: string): Promise<void>;
}

// core/memory/interfaces/entity-repository.ts
export interface IEntityRepository {
  add(entity: Entity): Promise<string>;
  get(id: string): Promise<Entity | null>;
  findByName(name: string): Promise<Entity[]>;
  merge(sourceId: string, targetId: string): Promise<void>;
  update(id: string, updates: Partial<Entity>): Promise<void>;
}

// core/memory/interfaces/search-service.ts
export interface IMemorySearchService {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  searchSemantic(embedding: number[], options?: SemanticSearchOptions): Promise<SearchResult[]>;
}

// core/memory/interfaces/memory-provider.ts
export interface IMemoryProvider extends 
  IEpisodeRepository,
  IEntityRepository,
  IRelationshipRepository,
  IFactRepository,
  IMemorySearchService,
  IDisposable {}

// Simpler interface for tools that only need search
export interface IMemoryReader {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getEntity(id: string): Promise<Entity | null>;
}
```

---

## Issue #6: Circular Dependencies Risk

### Current Problem

The re-export structure creates potential circular dependencies:

```typescript
// tools/index.ts
export * from './agent.js';
export * from './memory.js';
export * from './shell.js';
export * from './filesystem.js';
export * from './registry.js';
// ...

// If agent.ts imports from registry.ts which imports from tools/index.ts
// This creates a cycle
```

### Recommended Solution

**Explicit Dependency Graph:**

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     Orchestrator                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Runtime                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   AgentRuntime                           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│      Tools       │ │    Memory    │ │       RAG        │
│  ┌────────────┐  │ │ ┌──────────┐ │ │  ┌────────────┐  │
│  │ Filesystem │  │ │ │ Provider │ │ │  │  SearchEng │  │
│  │   Shell    │  │ │ │ Storage  │ │ │  │  Chunking  │  │
│  │  Registry  │  │ │ │ Extract  │ │ │  │  Rerank    │  │
│  └────────────┘  │ │ └──────────┘ │ │  └────────────┘  │
└──────────────────┘ └──────────────┘ └──────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          Core                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│  │ Interfaces│  │  Result   │  │  Config   │  │  Logger   │ │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Restructured Exports:**

```typescript
// Instead of tools/index.ts exporting everything
// Create specific entry points

// tools/filesystem/index.ts - Only filesystem exports
export { readFile, writeFile, listDirectory } from './file-operations.js';
export { validatePath } from './path-security.js';
export type { FileInfo, DirectoryTree } from './types.js';

// tools/shell/index.ts - Only shell exports  
export { executeCommand } from './shell.js';
export type { ShellOptions, ShellResult } from './types.js';

// tools/index.ts - Explicit, non-circular exports
export { filesystemTools } from './filesystem/tools.js';
export { shellTools } from './shell/tools.js';
export { memoryTools } from './memory/tools.js';

// No wildcard re-exports that could create cycles
```

---

## Issue #7: Missing Ports and Adapters Pattern

### Current Problem

External services are directly coupled to business logic:

```typescript
// core/embeddings/index.ts
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export function createEmbeddingService() {
  // Directly uses OpenAI SDK
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return {
    async embed(text: string) {
      const result = await embed({ model: openai.embedding('text-embedding-3-small'), value: text });
      return result.embedding;
    }
  };
}
```

### Recommended Solution

**Ports (Interfaces) and Adapters Pattern:**

```typescript
// core/ports/embedding-port.ts (Port = Interface)
export interface IEmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

// adapters/openai-embedding-adapter.ts (Adapter = Implementation)
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export class OpenAIEmbeddingAdapter implements IEmbeddingService {
  private model;
  
  constructor(private config: OpenAIConfig) {
    const openai = createOpenAI({ apiKey: config.apiKey });
    this.model = openai.embedding(config.model || 'text-embedding-3-small');
  }

  async embed(text: string): Promise<number[]> {
    const result = await embed({ model: this.model, value: text });
    return result.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  getDimensions(): number {
    return 1536; // text-embedding-3-small
  }
}

// adapters/ollama-embedding-adapter.ts
export class OllamaEmbeddingAdapter implements IEmbeddingService {
  constructor(private config: OllamaConfig) {}

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
      method: 'POST',
      body: JSON.stringify({ model: this.config.model, prompt: text }),
    });
    const data = await response.json();
    return data.embedding;
  }

  // ...
}

// adapters/cohere-embedding-adapter.ts
export class CohereEmbeddingAdapter implements IEmbeddingService {
  // Cohere-specific implementation
}

// Factory to create appropriate adapter based on config
export function createEmbeddingService(config: AppConfig): IEmbeddingService {
  switch (config.embeddings.provider) {
    case 'openai':
      return new OpenAIEmbeddingAdapter(config.embeddings);
    case 'ollama':
      return new OllamaEmbeddingAdapter(config.embeddings);
    case 'cohere':
      return new CohereEmbeddingAdapter(config.embeddings);
    default:
      throw new Error(`Unknown embedding provider: ${config.embeddings.provider}`);
  }
}
```

---

## Issue #8: Testing Architecture

### Current Problem

- Tests mixed with source files
- Heavy reliance on real APIs
- No clear mocking strategy
- Integration tests skip in CI

```typescript
// core/memory/index.test.ts
const hasRealApiKeys =
  process.env.OPENROUTER_API_KEY &&
  !process.env.OPENROUTER_API_KEY.includes('test') &&
  !process.env.CI;

describe.skipIf(!hasRealApiKeys)('Memory Integration', () => {
  // Tests that never run in CI
});
```

### Recommended Solution

**Test Structure:**

```
packages/core/
├── src/                    # Source code
│   ├── core/
│   ├── tools/
│   └── ...
├── tests/
│   ├── unit/               # Fast, isolated tests
│   │   ├── core/
│   │   │   ├── memory/
│   │   │   │   ├── extractor.test.ts
│   │   │   │   └── storage.test.ts
│   │   │   └── rag/
│   │   │       ├── bm25.test.ts
│   │   │       └── chunking.test.ts
│   │   └── tools/
│   │       ├── filesystem.test.ts
│   │       └── shell.test.ts
│   ├── integration/        # Tests with real dependencies
│   │   ├── memory-provider.test.ts
│   │   └── embedding-service.test.ts
│   ├── e2e/                # Full system tests
│   │   └── agent-workflow.test.ts
│   └── mocks/              # Shared test doubles
│       ├── memory-provider.mock.ts
│       ├── embedding-service.mock.ts
│       └── factories.ts
└── vitest.config.ts
```

**Mock Factories:**

```typescript
// tests/mocks/factories.ts
import { vi } from 'vitest';

export function createMockMemoryProvider(): jest.Mocked<IMemoryProvider> {
  return {
    addEpisode: vi.fn().mockResolvedValue('episode-123'),
    addEntity: vi.fn().mockResolvedValue('entity-456'),
    search: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
    // ... other methods
  };
}

export function createMockEmbeddingService(): jest.Mocked<IEmbeddingService> {
  return {
    embed: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
    embedBatch: vi.fn().mockImplementation((texts) => 
      Promise.resolve(texts.map(() => new Array(1536).fill(0)))
    ),
    getDimensions: vi.fn().mockReturnValue(1536),
  };
}

// tests/mocks/fixtures.ts
export const testEpisode: Episode = {
  id: 'ep-test-1',
  content: 'Test episode content',
  createdAt: new Date('2024-01-01'),
  groupId: 'group-1',
};

export const testEntity: Entity = {
  id: 'ent-test-1',
  name: 'Test Entity',
  type: 'person',
  attributes: {},
};
```

**Test Configuration:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['tests/**', '**/*.d.ts'],
    },
    setupFiles: ['tests/setup.ts'],
  },
});

// vitest.config.integration.ts
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    setupFiles: ['tests/setup.integration.ts'],
  },
});
```

---

## Issue #9: Missing Domain Events

### Current Problem

Components communicate through direct method calls, creating tight coupling:

```typescript
// runtime/agent-runtime.ts
export class AgentRuntime {
  async processMessage(message: string) {
    const response = await this.orchestrator.run(message);
    
    // Direct calls to update state everywhere
    await this.memoryExtractor.extractFromConversation(this.history);
    await this.toolRegistry.updateUsageStats(toolsUsed);
    await this.metrics.recordInteraction(response);
  }
}
```

### Recommended Solution

**Event-Driven Architecture:**

```typescript
// core/events/event-bus.ts
type EventHandler<T> = (event: T) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();

  on<T>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  async emit<T>(eventType: string, event: T): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      await Promise.all([...handlers].map(h => h(event)));
    }
  }
}

// core/events/events.ts
export interface ConversationCompletedEvent {
  type: 'conversation.completed';
  sessionId: string;
  messages: Message[];
  toolsUsed: string[];
  duration: number;
}

export interface ToolExecutedEvent {
  type: 'tool.executed';
  toolName: string;
  args: unknown;
  result: unknown;
  duration: number;
}

export interface MemoryExtractedEvent {
  type: 'memory.extracted';
  sessionId: string;
  entities: Entity[];
  facts: Fact[];
}

// Usage
class AgentRuntime {
  constructor(private eventBus: EventBus) {}

  async processMessage(message: string) {
    const startTime = Date.now();
    const response = await this.orchestrator.run(message);
    
    // Emit event instead of direct calls
    await this.eventBus.emit('conversation.completed', {
      type: 'conversation.completed',
      sessionId: this.sessionId,
      messages: this.history,
      toolsUsed: response.toolsUsed,
      duration: Date.now() - startTime,
    });
    
    return response;
  }
}

// Handlers registered during bootstrap
class MemoryExtractor {
  constructor(eventBus: EventBus) {
    eventBus.on('conversation.completed', this.handleConversation.bind(this));
  }

  private async handleConversation(event: ConversationCompletedEvent) {
    await this.extractFromConversation(event.messages);
  }
}
```

---

## Issue #10: Missing Resource Management

### Current Problem

No unified approach to managing resources (connections, handles, etc.):

```typescript
// Various cleanup patterns scattered around
async close() {
  clearInterval(this.checkpointInterval);
  this.db.close();
}

async dispose() {
  // Different naming, different behavior
}

// Some resources have no cleanup at all
```

### Recommended Solution

**Disposable Pattern:**

```typescript
// core/lifecycle/disposable.ts
export interface IDisposable {
  dispose(): Promise<void>;
}

export interface IAsyncDisposable {
  [Symbol.asyncDispose](): Promise<void>;
}

export class DisposableStack implements IDisposable {
  private resources: IDisposable[] = [];

  use<T extends IDisposable>(resource: T): T {
    this.resources.push(resource);
    return resource;
  }

  async dispose(): Promise<void> {
    const errors: Error[] = [];
    
    // Dispose in reverse order (LIFO)
    while (this.resources.length > 0) {
      const resource = this.resources.pop()!;
      try {
        await resource.dispose();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Failed to dispose some resources');
    }
  }
}

// Usage
class AgentSession implements IDisposable {
  private disposables = new DisposableStack();
  
  constructor() {
    this.memoryProvider = this.disposables.use(createMemoryProvider());
    this.codebaseRAG = this.disposables.use(createCodebaseRAG());
    this.thinkingEngine = this.disposables.use(new SequentialThinkingEngine());
  }
  
  async dispose(): Promise<void> {
    await this.disposables.dispose();
  }
}

// With using declaration (TS 5.2+)
async function runAgent() {
  await using session = new AgentSession();
  // session.dispose() automatically called when scope exits
}
```

---

## Proposed New Architecture

```
packages/core/
├── src/
│   ├── application/              # Application services
│   │   ├── orchestrator.ts
│   │   ├── session-manager.ts
│   │   └── index.ts
│   │
│   ├── domain/                   # Core business logic (no dependencies)
│   │   ├── entities/
│   │   │   ├── episode.ts
│   │   │   ├── entity.ts
│   │   │   ├── fact.ts
│   │   │   └── relationship.ts
│   │   ├── value-objects/
│   │   │   ├── embedding.ts
│   │   │   └── chunk.ts
│   │   └── events/
│   │       └── domain-events.ts
│   │
│   ├── ports/                    # Interfaces (abstractions)
│   │   ├── memory-repository.ts
│   │   ├── embedding-service.ts
│   │   ├── search-service.ts
│   │   ├── tool-registry.ts
│   │   └── logger.ts
│   │
│   ├── adapters/                 # Implementations
│   │   ├── memory/
│   │   │   ├── sqlite-adapter.ts
│   │   │   ├── graphiti-adapter.ts
│   │   │   └── in-memory-adapter.ts
│   │   ├── embeddings/
│   │   │   ├── openai-adapter.ts
│   │   │   ├── ollama-adapter.ts
│   │   │   └── cohere-adapter.ts
│   │   └── logging/
│   │       └── winston-adapter.ts
│   │
│   ├── services/                 # Domain services
│   │   ├── memory-extractor.ts
│   │   ├── rag-service.ts
│   │   └── rerank-service.ts
│   │
│   ├── tools/                    # Tool implementations
│   │   ├── filesystem/
│   │   ├── shell/
│   │   ├── web-search/
│   │   └── registry/
│   │
│   ├── infrastructure/           # Cross-cutting concerns
│   │   ├── config/
│   │   │   ├── schema.ts
│   │   │   ├── loader.ts
│   │   │   └── index.ts
│   │   ├── container/
│   │   │   ├── types.ts
│   │   │   └── container.ts
│   │   ├── events/
│   │   │   └── event-bus.ts
│   │   └── lifecycle/
│   │       └── disposable.ts
│   │
│   ├── shared/                   # Shared utilities
│   │   ├── result.ts
│   │   ├── errors.ts
│   │   └── types.ts
│   │
│   └── index.ts                  # Public API
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── mocks/
│
└── package.json
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
1. ✅ Create centralized configuration system
2. ✅ Define core interfaces (ports)
3. ✅ Implement Result type and error handling
4. ✅ Set up test infrastructure with mocks

### Phase 2: Refactor Core (Week 3-4)
1. Extract adapters from embedded implementations
2. Implement dependency injection (or factory pattern)
3. Add event bus for decoupled communication
4. Implement disposable pattern for resources

### Phase 3: Clean Up Tools (Week 5-6)
1. Standardize tool result types
2. Remove global state from tools
3. Add session-scoped context
4. Implement proper tool lifecycle

### Phase 4: Testing & Documentation (Week 7-8)
1. Add comprehensive unit tests with mocks
2. Ensure integration tests work in CI
3. Document public APIs
4. Create architecture decision records (ADRs)

---

## Quick Wins (Can Implement Today)

1. **Create config module** - Centralize all magic numbers and env vars
2. **Standardize error handling** - Use Result type everywhere
3. **Add interfaces** - Even without DI, interfaces improve testability
4. **Move tests** - Separate test files from source
5. **Add JSDoc** - Document public APIs
6. **Remove unused exports** - Clean up barrel files

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Cyclomatic Complexity (avg) | ~15 | <10 |
| Coupling Between Objects | High | Low |
| Test Coverage | ~40% | >80% |
| Type Coverage | ~85% | >95% |
| Documentation Coverage | ~20% | >80% |
| Circular Dependencies | Several | 0 |

# Functional-First Architecture Guide

## Philosophy

**Use classes only when you need to:**
1. Manage complex mutable state that changes over time
2. Implement interfaces for polymorphism (and even then, consider object literals)
3. Lifecycle management (resources that need setup/teardown)

**Use functions for everything else:**
- Transformations
- API calls
- Validation
- Factory creation
- Most "services"

---

## What Should Stay as Classes

These legitimately need class-based state management:

```typescript
// ✅ SessionManager - tracks multiple sessions over time
class SessionManager {
  private sessions = new Map<string, SessionContext>();
  
  create(id: string): SessionContext { /* ... */ }
  get(id: string): SessionContext | undefined { /* ... */ }
  dispose(id: string): Promise<void> { /* ... */ }
}

// ✅ TaskManager - manages running processes, complex lifecycle
class TaskManager {
  private processes = new Map<string, ChildProcess>();
  private db: Database;
  
  start(command: string): Promise<string> { /* ... */ }
  stop(taskId: string): Promise<void> { /* ... */ }
  getStatus(taskId: string): TaskStatus { /* ... */ }
}

// ✅ SequentialThinkingEngine - accumulates history, branches
class SequentialThinkingEngine {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Map<string, ThoughtData[]> = new Map();
  
  addThought(thought: ThoughtData): void { /* ... */ }
  branch(fromId: string): string { /* ... */ }
  getHistory(): ThoughtData[] { /* ... */ }
}

// ✅ DisposableStack - accumulates resources for cleanup
class DisposableStack {
  private resources: Disposable[] = [];
  
  use<T extends Disposable>(resource: T): T { /* ... */ }
  dispose(): Promise<void> { /* ... */ }
}
```

---

## What Should Become Functions

### Before: Class-based Adapters

```typescript
// ❌ Unnecessary class - no state, just wraps API calls
class OpenAIEmbeddingAdapter implements IEmbeddingService {
  private model;
  
  constructor(private config: OpenAIConfig) {
    const openai = createOpenAI({ apiKey: config.apiKey });
    this.model = openai.embedding(config.model);
  }

  async embed(text: string): Promise<number[]> {
    const result = await embed({ model: this.model, value: text });
    return result.embedding;
  }

  getDimensions(): number {
    return 1536;
  }
}

// Usage requires instantiation
const adapter = new OpenAIEmbeddingAdapter(config);
const embedding = await adapter.embed("hello");
```

### After: Function-based Approach

```typescript
// ✅ Simple functions - config passed explicitly or closed over
export function createEmbeddingService(config: EmbeddingConfig) {
  const openai = createOpenAI({ apiKey: config.apiKey });
  const model = openai.embedding(config.model || 'text-embedding-3-small');
  
  return {
    embed: async (text: string): Promise<number[]> => {
      const result = await embed({ model, value: text });
      return result.embedding;
    },
    
    embedBatch: async (texts: string[]): Promise<number[][]> => {
      return Promise.all(texts.map(async t => {
        const result = await embed({ model, value: t });
        return result.embedding;
      }));
    },
    
    dimensions: 1536,
  };
}

// Or even simpler - just export functions directly
export function createOpenAIEmbed(config: OpenAIConfig) {
  const openai = createOpenAI({ apiKey: config.apiKey });
  const model = openai.embedding(config.model || 'text-embedding-3-small');
  
  return async (text: string): Promise<number[]> => {
    const result = await embed({ model, value: text });
    return result.embedding;
  };
}

// Usage - cleaner
const embed = createOpenAIEmbed(config);
const embedding = await embed("hello");
```

---

## Refactored Architecture Examples

### 1. Memory Provider (Functional)

```typescript
// types.ts
export interface MemoryStore {
  // Queries
  getEpisode: (id: string) => Promise<Episode | null>;
  getEntity: (id: string) => Promise<Entity | null>;
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  
  // Commands
  addEpisode: (episode: Episode) => Promise<string>;
  addEntity: (entity: Entity) => Promise<string>;
  addFact: (fact: Fact) => Promise<string>;
  
  // Lifecycle
  close: () => Promise<void>;
}

// sqlite-store.ts
export function createSQLiteStore(dbPath: string): MemoryStore {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  
  const checkpointInterval = setInterval(() => {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
  }, 60000);

  return {
    getEpisode: async (id) => {
      const row = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id);
      return row ? mapRowToEpisode(row) : null;
    },

    getEntity: async (id) => {
      const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
      return row ? mapRowToEntity(row) : null;
    },

    search: async (query, options = {}) => {
      // Implementation
    },

    addEpisode: async (episode) => {
      const id = episode.id || generateId();
      db.prepare('INSERT INTO episodes ...').run(/* ... */);
      return id;
    },

    addEntity: async (entity) => {
      const id = entity.id || generateId();
      db.prepare('INSERT INTO entities ...').run(/* ... */);
      return id;
    },

    addFact: async (fact) => {
      const id = fact.id || generateId();
      db.prepare('INSERT INTO facts ...').run(/* ... */);
      return id;
    },

    close: async () => {
      clearInterval(checkpointInterval);
      db.close();
    },
  };
}

// in-memory-store.ts
export function createInMemoryStore(): MemoryStore {
  const episodes = new Map<string, Episode>();
  const entities = new Map<string, Entity>();
  const facts = new Map<string, Fact>();

  return {
    getEpisode: async (id) => episodes.get(id) ?? null,
    getEntity: async (id) => entities.get(id) ?? null,
    
    search: async (query, options) => {
      // Simple in-memory search
    },

    addEpisode: async (episode) => {
      const id = episode.id || generateId();
      episodes.set(id, { ...episode, id });
      return id;
    },

    addEntity: async (entity) => {
      const id = entity.id || generateId();
      entities.set(id, { ...entity, id });
      return id;
    },

    addFact: async (fact) => {
      const id = fact.id || generateId();
      facts.set(id, { ...fact, id });
      return id;
    },

    close: async () => {
      episodes.clear();
      entities.clear();
      facts.clear();
    },
  };
}

// factory.ts
export function createMemoryStore(config: MemoryConfig): MemoryStore {
  switch (config.provider) {
    case 'sqlite':
      return createSQLiteStore(config.storagePath);
    case 'in-memory':
      return createInMemoryStore();
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

### 2. RAG System (Functional)

```typescript
// bm25.ts
export function createBM25Index() {
  const engine = BM25();
  let consolidated = false;

  engine.definePrepTasks([
    (text: string) => text.toLowerCase(),
    (text: string) => text.replace(/[^\w\s]/g, ' '),
    (text: string) => text.split(/\s+/).filter(t => t.length > 1),
  ]);

  return {
    add: (doc: { id: string; content: string }) => {
      if (consolidated) throw new Error('Cannot add after consolidation');
      engine.addDoc(doc, doc.id visibleTo);
    },

    consolidate: () => {
      if (!consolidated) {
        engine.consolidate();
        consolidated = true;
      }
    },

    search: (query: string, limit = 10): string[] => {
      if (!consolidated) throw new Error('Must consolidate before search');
      return engine.search(query, limit);
    },

    isConsolidated: () => consolidated,
  };
}

// chunking.ts
export type ChunkFn = (content: string, filePath: string) => Chunk[];

export function createCodeChunker(parserFactory: ParserFactory): ChunkFn {
  return (content, filePath) => {
    const ext = path.extname(filePath);
    const parser = parserFactory.getParser(ext);
    
    if (!parser) {
      return fallbackChunk(content, filePath);
    }
    
    const tree = parser.parse(content);
    return extractChunksFromAST(tree, content, filePath);
  };
}

export function createDocumentChunker(options: ChunkOptions = {}): ChunkFn {
  const { maxSize = 1000, overlap = 100 } = options;
  
  return (content, filePath) => {
    const chunks: Chunk[] = [];
    const sentences = splitIntoSentences(content);
    
    let current = '';
    for (const sentence of sentences) {
      if (current.length + sentence.length > maxSize && current) {
        chunks.push(createChunk(current, filePath, chunks.length));
        current = current.slice(-overlap);
      }
      current += sentence;
    }
    
    if (current) {
      chunks.push(createChunk(current, filePath, chunks.length));
    }
    
    return chunks;
  };
}

// search-engine.ts
export function createSearchEngine(deps: {
  embed: (text: string) => Promise<number[]>;
  bm25: ReturnType<typeof createBM25Index>;
  chunks: Chunk[];
}) {
  const { embed, bm25, chunks } = deps;
  const chunkMap = new Map(chunks.map(c => [c.id, c]));

  return {
    search: async (query: string, options: SearchOptions = {}) => {
      const { topK = 10, useSemanticSearch = true } = options;

      // BM25 search
      const bm25Results = bm25.search(query, topK * 2);

      if (!useSemanticSearch) {
        return bm25Results.slice(0, topK).map(id => chunkMap.get(id)!);
      }

      // Semantic search
      const queryEmbedding = await embed(query);
      const scored = chunks.map(chunk => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding!),
      }));

      // Combine results (RRF fusion)
      return fuseResults(bm25Results, scored, topK);
    },
  };
}
```

### 3. Tool System (Functional)

```typescript
// tool-types.ts
export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  schema: z.ZodSchema<TInput>;
  execute: (input: TInput) => Promise<Result<TOutput>>;
}

// filesystem-tools.ts
export function createFilesystemTools(config: FilesystemConfig): Tool[] {
  const { allowedDirs, maxFileSize } = config;

  const validatePath = (p: string): Result<string> => {
    const resolved = path.resolve(p);
    const isAllowed = allowedDirs.some(dir => resolved.startsWith(dir));
    return isAllowed 
      ? Result.ok(resolved)
      : Result.err(new SecurityError(`Path not allowed: ${p}`));
  };

  const readFile: Tool<{ path: string }, string> = {
    name: 'read_file',
    description: 'Read contents of a file',
    schema: z.object({ path: z.string() }),
    execute: async ({ path: filePath }) => {
      const validated = validatePath(filePath);
      if (!validated.success) return validated;
      
      try {
        const content = await fs.readFile(validated.data, 'utf-8');
        return Result.ok(content);
      } catch (e) {
        return Result.err(new ResourceError(`Failed to read: ${e}`));
      }
    },
  };

  const writeFile: Tool<{ path: string; content: string }, void> = {
    name: 'write_file',
    description: 'Write content to a file',
    schema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path: filePath, content }) => {
      const validated = validatePath(filePath);
      if (!validated.success) return validated;
      
      if (content.length > maxFileSize) {
        return Result.err(new ValidationError('Content too large'));
      }
      
      try {
        await fs.writeFile(validated.data, content, 'utf-8');
        return Result.ok(undefined);
      } catch (e) {
        return Result.err(new ResourceError(`Failed to write: ${e}`));
      }
    },
  };

  return [readFile, writeFile];
}

// shell-tools.ts
export function createShellTool(config: ShellConfig): Tool {
  const { blockedPatterns, timeout, cwd } = config;

  const isDangerous = (cmd: string): boolean =>
    blockedPatterns.some(pattern => pattern.test(cmd));

  return {
    name: 'shell',
    description: 'Execute a shell command',
    schema: z.object({
      command: z.string().max(10000),
      cwd: z.string().optional(),
    }),
    execute: async ({ command, cwd: workDir }) => {
      if (isDangerous(command)) {
        return Result.err(new SecurityError('Command blocked'));
      }

      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: workDir || cwd,
          timeout,
        });
        return Result.ok({ stdout, stderr });
      } catch (e) {
        return Result.err(new ResourceError(`Execution failed: ${e}`));
      }
    },
  };
}

// registry.ts
export function createToolRegistry(tools: Tool[]) {
  const byName = new Map(tools.map(t => [t.name, t]));

  return {
    get: (name: string) => byName.get(name),
    list: () => [...byName.values()],
    has: (name: string) => byName.has(name),
    
    execute: async (name: string, input: unknown) => {
      const tool = byName.get(name);
      if (!tool) return Result.err(new Error(`Unknown tool: ${name}`));
      
      const parsed = tool.schema.safeParse(input);
      if (!parsed.success) {
        return Result.err(new ValidationError(parsed.error.message));
      }
      
      return tool.execute(parsed.data);
    },
  };
}
```

### 4. Event System (Functional)

```typescript
// events.ts - No class needed!
export type EventHandler<T> = (event: T) => void | Promise<void>;

export function createEventBus() {
  const handlers = new Map<string, Set<EventHandler<any>>>();

  return {
    on: <T>(event: string, handler: EventHandler<T>) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)?.delete(handler);
    },

    emit: async <T>(event: string, data: T) => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        await Promise.all([...eventHandlers].map(h => h(data)));
      }
    },

    once: <T>(event: string, handler: EventHandler<T>) => {
      const wrapper: EventHandler<T> = async (data) => {
        handlers.get(event)?.delete(wrapper);
        await handler(data);
      };
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(wrapper);
    },
  };
}

// Usage
const events = createEventBus();

events.on('tool.executed', ({ name, duration }) => {
  console.log(`Tool ${name} took ${duration}ms`);
});

await events.emit('tool.executed', { name: 'read_file', duration: 42 });
```

### 5. Configuration (Functional)

```typescript
// config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  memory: z.object({
    provider: z.enum(['sqlite', 'in-memory']).default('sqlite'),
    storagePath: z.string().default('./data/memory.db'),
  }),
  rag: z.object({
    rerankTopN: z.number().default(100),
    returnTopN: z.number().default(8),
    maxTokensPerSearch: z.number().default(3000),
  }),
  tasks: z.object({
    maxConcurrent: z.number().default(50),
    maxLogSizeMB: z.number().default(100),
  }),
  models: z.object({
    fast: z.string().default('deepseek/deepseek-chat'),
    reasoning: z.string().default('anthropic/claude-3.5-sonnet'),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return ConfigSchema.parse({
    memory: {
      provider: process.env.MEMORY_PROVIDER,
      storagePath: process.env.MEMORY_DB_PATH,
    },
    rag: {
      rerankTopN: process.env.RERANK_TOP_N ? parseInt(process.env.RERANK_TOP_N) : undefined,
    },
    models: {
      fast: process.env.MODEL_FAST,
      reasoning: process.env.MODEL_REASONING,
    },
    ...overrides,
  });
}
```

### 6. Application Bootstrap (Functional)

```typescript
// bootstrap.ts
export function createApp(config: AppConfig) {
  // Create all dependencies
  const embed = createOpenAIEmbed({ apiKey: process.env.OPENAI_API_KEY! });
  const memoryStore = createMemoryStore(config.memory);
  const events = createEventBus();
  
  const filesystemTools = createFilesystemTools({ 
    allowedDirs: [process.cwd()],
    maxFileSize: 10 * 1024 * 1024,
  });
  
  const shellTool = createShellTool({
    blockedPatterns: DANGEROUS_PATTERNS,
    timeout: 30000,
    cwd: process.cwd(),
  });
  
  const toolRegistry = createToolRegistry([
    ...filesystemTools,
    shellTool,
  ]);

  // Wire up event handlers
  events.on('conversation.completed', async ({ messages }) => {
    await extractMemory(messages, memoryStore, embed);
  });

  // Return the app interface
  return {
    config,
    memoryStore,
    toolRegistry,
    events,
    
    run: async (message: string) => {
      // Orchestration logic
    },
    
    close: async () => {
      await memoryStore.close();
    },
  };
}

// main.ts
const config = loadConfig();
const app = createApp(config);

process.on('SIGTERM', async () => {
  await app.close();
  process.exit(0);
});

await app.run('Hello!');
```

---

## Summary: Class vs Function Decision Tree

```
Need to track state that changes over time?
├─ Yes: Is state complex (multiple interdependent pieces)?
│   ├─ Yes → Use a class
│   │   Examples: SessionManager, TaskManager, ThinkingEngine
│   └─ No → Use closure (factory function returning object)
│       Examples: createBM25Index, createEventBus
└─ No: Is it a collection of related operations?
    ├─ Yes → Return object literal from factory function
    │   Examples: createMemoryStore, createSearchEngine
    └─ No → Just export plain functions
        Examples: validatePath, cosineSimilarity, loadConfig
```

## Final Architecture: Minimal Classes

```
Classes (4 total):
├── SessionManager      # Manages multiple sessions
├── TaskManager         # Manages background processes  
├── ThinkingEngine      # Complex branching state
└── DisposableStack     # Resource accumulation

Everything else → Functions:
├── createMemoryStore()     → { getEpisode, addEpisode, search, close }
├── createEmbedding()       → async (text) => number[]
├── createToolRegistry()    → { get, list, execute }
├── createSearchEngine()    → { search }
├── createEventBus()        → { on, emit, once }
├── createBM25Index()       → { add, search, consolidate }
├── loadConfig()            → AppConfig
└── bootstrap()             → App
```

This approach gives you:
- **Easier testing** - just pass mock functions
- **Better tree-shaking** - unused functions get eliminated
- **Simpler mental model** - data in, data out
- **No `this` binding issues**
- **More composable** - pipe functions together easily