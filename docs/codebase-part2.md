# AI Agent Platform - Extended Documentation

## Note

This document previously contained continuation of the codebase documentation. As of the latest update, all codebase documentation has been consolidated into **`codebase.md`**, which now provides comprehensive coverage of the entire monorepo architecture.

**Please refer to `codebase.md` for complete documentation.**

This file is retained for any extended topics or advanced use cases not covered in the main documentation.

---

## Extended Topics

### Advanced RAG Configuration

#### Custom Chunking Strategies

To create a custom chunking strategy for a new file type:

```typescript
// packages/core/src/core/rag/strategies/custom-strategy.ts
import { BaseChunkingStrategy, type Chunk } from './base.js';

export class CustomChunkingStrategy extends BaseChunkingStrategy {
  name = 'custom';
  supportedExtensions = ['.custom'];

  async chunkFile(content: string, filePath: string): Promise<Chunk[]> {
    // Implement custom chunking logic
    const chunks: Chunk[] = [];

    // Example: Split by custom delimiter
    const sections = content.split('---SECTION---');

    for (let i = 0; i < sections.length; i++) {
      chunks.push({
        content: sections[i].trim(),
        metadata: {
          type: 'section',
          index: i,
          filePath,
          language: 'custom',
        },
      });
    }

    return chunks;
  }
}
```

Register the strategy:

```typescript
// In your initialization code
import { StrategyRegistry } from '@agent/core';
import { CustomChunkingStrategy } from './custom-strategy.js';

const registry = new StrategyRegistry();
registry.register(new CustomChunkingStrategy());
```

#### Fine-tuning RAG Parameters

```typescript
import { createCodebaseRAG } from '@agent/core';

const rag = createCodebaseRAG(workspaceRoot, {
  // Chunking options
  maxChunkSize: 1500,           // Max characters per chunk
  chunkOverlap: 100,             // Overlap between chunks

  // Context generation
  generateContext: true,         // Enable LLM-based context
  contextConcurrency: 5,         // Parallel context generation

  // Embedding options
  embeddingModel: 'text-embedding-004',
  embeddingBatchSize: 50,

  // Search options
  vectorSearchTopK: 100,
  bm25SearchTopK: 100,
  rerankTopK: 20,

  // Caching
  cacheDir: '.rag-cache',
  enableCache: true,
});
```

### Advanced Memory System Usage

#### Custom Memory Extraction

Override default extraction behavior:

```typescript
import { createMemoryProvider, extractFromText } from '@agent/core';

const memoryProvider = await createMemoryProvider({
  provider: 'lite',
  storagePath: './custom-memory.db',
});

// Custom extraction with specific entities
const customExtraction = await extractFromText(
  conversationText,
  extractionModel,
  existingEntityNames, // Helps with entity normalization
  {
    // Custom extraction hints
    entityTypes: ['person', 'project', 'api', 'database'],
    extractRelations: true,
    extractFacts: true,
    minConfidence: 0.8,
  }
);
```

#### Memory Graph Traversal

Advanced graph queries:

```typescript
import { getMemoryProvider } from '@agent/core';

const memory = getMemoryProvider();

// Find all projects Randy works on
const randy = await memory.getEntity(randyEntityId);
const relatedEntities = await memory.getRelatedEntities(randy.id, 2); // depth=2

// Filter to only projects
const projects = relatedEntities.filter(e => e.type === 'project');

// Get all facts about these projects
const projectFacts = [];
for (const project of projects) {
  const facts = await memory.search({
    query: project.name,
    maxResults: 10,
  });
  projectFacts.push(...facts.facts);
}
```

### Device Control Advanced Usage

#### Custom Device Actions

Implement platform-specific actions:

```typescript
import { createDeviceTools } from '@agent/device-use';

const deviceTools = createDeviceTools({
  platform: 'desktop',
  config: {
    screenWidth: 1920,
    screenHeight: 1080,
    // Custom automation scripts
    customActions: {
      openApp: async (appName: string) => {
        // Platform-specific app launching
        if (process.platform === 'darwin') {
          // macOS
          await exec(`open -a "${appName}"`);
        } else if (process.platform === 'win32') {
          // Windows
          await exec(`start ${appName}`);
        } else {
          // Linux
          await exec(`xdg-open ${appName}`);
        }
      },
    },
  },
});
```

#### Mobile Device Testing

Automate mobile testing workflows:

```typescript
import { createDeviceTools } from '@agent/device-use';

const mobileTools = createDeviceTools({
  platform: 'android',
  config: {
    deviceId: 'emulator-5554',
    appPackage: 'com.example.app',
    appActivity: '.MainActivity',
  },
});

// Automated test flow
const result = await mobileTools.computer_use.execute({
  action: 'type',
  text: 'test@example.com',
  coordinate: [500, 800],
});
```

### Benchmark Integration

#### Running Custom Benchmarks

Create custom benchmark tasks:

```typescript
import { createAgentRuntime } from '@agent/core';

async function runCustomBenchmark(tasks: CustomTask[]) {
  const runtime = await createAgentRuntime({
    workspaceRoot: '/path/to/benchmark/workspace',
  });

  const results = [];

  for (const task of tasks) {
    const session = runtime.createSession();

    const result = await session.send(task.prompt);

    results.push({
      taskId: task.id,
      success: validateResult(result, task.expectedOutput),
      stepsUsed: result.stepsUsed,
      toolsUsed: result.toolsUsed,
    });

    session.clearHistory();
  }

  await runtime.shutdown();

  return results;
}
```

#### Benchmark Result Analysis

```typescript
import { scoreGAIAResults, scoreSWEBenchResults } from '@agent/benchmarks';

// Analyze GAIA results
const gaiaScore = scoreGAIAResults(results);
console.log(`GAIA Score: ${gaiaScore.accuracy}%`);
console.log(`Avg Steps: ${gaiaScore.avgSteps}`);
console.log(`Tool Usage: ${JSON.stringify(gaiaScore.toolUsage)}`);

// Analyze SWE-bench results
const sweScore = scoreSWEBenchResults(results);
console.log(`Pass Rate: ${sweScore.passRate}%`);
console.log(`Resolved Issues: ${sweScore.resolvedIssues}`);
```

### Performance Optimization

#### RAG Cache Warming

Pre-cache embeddings for faster first queries:

```typescript
import { createCodebaseRAG } from '@agent/core';

const rag = createCodebaseRAG(workspaceRoot);

// Index codebase (warm cache)
console.time('Initial indexing');
await rag.indexCodebase();
console.timeEnd('Initial indexing'); // ~30s for medium codebase

// Subsequent searches are fast
console.time('Search');
const results = await rag.searchCodebase('authentication');
console.timeEnd('Search'); // <100ms
```

#### Memory Query Optimization

Optimize frequent queries with caching:

```typescript
import { getMemoryProvider } from '@agent/core';
import { LRUCache } from 'lru-cache';

const queryCache = new LRUCache<string, SearchResult>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 minutes
});

async function cachedMemorySearch(query: string) {
  const cached = queryCache.get(query);
  if (cached) return cached;

  const memory = getMemoryProvider();
  const result = await memory.search({ query, maxResults: 10 });

  queryCache.set(query, result);
  return result;
}
```

#### Tool Registry Optimization

Optimize semantic search with pre-computed embeddings:

```typescript
import { createToolRegistry } from '@agent/core';

const registry = createToolRegistry();

// Register all tools
registry.registerMany(tools, { deferLoading: false });

// Generate embeddings once at startup
await registry.generateEmbeddings();

// Fast semantic searches
const mathTools = await registry.searchSemantic('mathematical operations');
const fileTools = await registry.searchSemantic('file system operations');
```

### Production Deployment Considerations

#### Scaling HTTP Server

Use cluster mode for better performance:

```typescript
import cluster from 'cluster';
import os from 'os';
import { startServer } from '@agent/server';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Restart worker
  });
} else {
  startServer({
    port: parseInt(process.env.PORT || '3000'),
    workspaceRoot: process.env.WORKSPACE_ROOT,
  });
}
```

#### External Session Store

Use Redis for distributed sessions:

```typescript
import { createClient } from 'redis';
import { createAgentRuntime } from '@agent/core';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const sessionStore = {
  async get(sessionId: string) {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  },

  async set(sessionId: string, session: any) {
    await redis.set(
      `session:${sessionId}`,
      JSON.stringify(session),
      { EX: 3600 } // 1 hour TTL
    );
  },

  async delete(sessionId: string) {
    await redis.del(`session:${sessionId}`);
  },
};
```

#### Monitoring and Observability

Integrate with monitoring tools:

```typescript
import { logger } from '@agent/shared';
import { instrumentTools } from '@agent/core';

// Add custom metrics
const metrics = {
  toolCallsTotal: 0,
  toolCallDurations: [] as number[],
  errors: [] as string[],
};

// Wrap tools with metrics collection
const monitoredTools = instrumentTools(tools);

// Export metrics endpoint
app.get('/metrics', (c) => {
  return c.json({
    toolCallsTotal: metrics.toolCallsTotal,
    avgToolCallDuration: average(metrics.toolCallDurations),
    errorRate: metrics.errors.length / metrics.toolCallsTotal,
    recentErrors: metrics.errors.slice(-10),
  });
});
```

### Testing Strategies

#### Integration Testing

Test agent behavior end-to-end:

```typescript
import { describe, it, expect } from 'vitest';
import { createAgentRuntime } from '@agent/core';

describe('Agent Integration Tests', () => {
  it('should complete file read and analysis task', async () => {
    const runtime = await createAgentRuntime({
      workspaceRoot: '/path/to/test/workspace',
    });

    const session = runtime.createSession();

    const result = await session.send(
      'Read the package.json file and tell me what dependencies are used'
    );

    expect(result.completed).toBe(true);
    expect(result.toolsUsed).toContain('read_file');
    expect(result.text).toContain('dependencies');

    await runtime.shutdown();
  });

  it('should handle multi-step reasoning', async () => {
    const runtime = await createAgentRuntime();
    const session = runtime.createSession();

    const result = await session.send(
      'Search the web for TypeScript best practices, ' +
      'then create a summary file'
    );

    expect(result.toolsUsed).toContain('web_search');
    expect(result.toolsUsed).toContain('write_file');
    expect(result.stepsUsed).toBeGreaterThan(3);

    await runtime.shutdown();
  });
});
```

#### Tool Testing

Test individual tools in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { createFilesystemTools, setAllowedDirectories } from '@agent/core';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Filesystem Tools', () => {
  let testDir: string;
  let tools: ReturnType<typeof createFilesystemTools>;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agent-test-'));
    setAllowedDirectories([testDir]);
    tools = createFilesystemTools();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should read and write files', async () => {
    const filePath = join(testDir, 'test.txt');

    await tools.write_file.execute({
      path: filePath,
      content: 'Hello, World!',
    });

    const result = await tools.read_file.execute({ path: filePath });
    expect(JSON.parse(result).content).toBe('Hello, World!');
  });

  it('should enforce path sandboxing', async () => {
    await expect(
      tools.read_file.execute({ path: '/etc/passwd' })
    ).rejects.toThrow('Path is not within allowed directories');
  });
});
```

---

## Additional Resources

### Community Examples

Check the `packages/benchmarks/examples/` directory for:
- HAL benchmark examples
- tau-bench conversation flows
- SWE-bench task completions
- GAIA challenge solutions

### Architecture Evolution

For the long-term roadmap and planned enhancements, see:
- `docs/ARCHITECTURE.md` - Complete evolution plan
- `docs/COMPETITIVE_ANALYSIS.md` - Feature comparison with other platforms

### Contributing

For guidelines on contributing to the codebase:
- `CONTRIBUTING.md` - Contribution guidelines
- `TESTING.md` - Testing strategies
- `CLAUDE.md` - Development process

---

**Note**: This document provides extended topics beyond the main `codebase.md` documentation. For fundamental understanding of the codebase, always start with `codebase.md`.
