# AI Agent Platform - Extended Documentation

## Note

This document contains advanced topics, extended configurations, and detailed implementation guides that go beyond the core documentation in `codebase.md`.

**For fundamental understanding of the codebase, start with `codebase.md`.**

---

## Extended Topics

### Local Model Deployment with Ollama

The platform supports running entirely locally using Ollama, eliminating cloud dependencies and API costs.

#### Setup Ollama

1. **Install Ollama**:
```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Or download from https://ollama.com
```

2. **Pull Required Models**:
```bash
# LLM models (choose based on your hardware)
ollama pull qwen3:4b              # Fast tier (2.5GB)
ollama pull qwen2.5-coder:14b     # Standard/Powerful (9GB)
ollama pull deepseek-r1:14b       # Reasoning (9GB)

# Embedding model
ollama pull nomic-embed-text      # Embeddings (274MB)
```

3. **Configure Environment**:
```bash
# .env
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434/api

# Optional: Customize models
OLLAMA_FAST_MODEL=qwen3:4b
OLLAMA_STANDARD_MODEL=qwen2.5-coder:14b
OLLAMA_REASONING_MODEL=deepseek-r1:14b
OLLAMA_POWERFUL_MODEL=qwen2.5-coder:14b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

#### Hardware Recommendations

**Minimum**:
- RAM: 8GB
- Storage: 15GB free
- CPU: 4 cores
- Models: qwen3:4b (fast tier only)

**Recommended**:
- RAM: 16GB+
- Storage: 30GB+ free
- CPU: 8+ cores
- GPU: NVIDIA with 8GB+ VRAM (optional, significant speedup)
- Models: Full model suite

**GPU Acceleration**:
```bash
# Ollama automatically uses GPU if available
# Verify GPU usage:
ollama run qwen2.5-coder:14b "Hello"
# Check logs for GPU initialization
```

#### Hybrid Mode

Mix cloud and local models for optimal cost/performance:

```bash
# Use Ollama for most tasks, cloud for complex reasoning
OLLAMA_ENABLED=true
OLLAMA_FAST_MODEL=qwen3:4b
OLLAMA_STANDARD_MODEL=qwen2.5-coder:14b

# Override powerful tier to use Claude
MODEL_POWERFUL=anthropic/claude-sonnet-4
OPENROUTER_API_KEY=your_key_here
```

Modify `packages/core/src/core/agents/models.ts` to customize per-tier selection.

#### Performance Comparison

**Throughput** (tokens/second, 14B models):

| Hardware | CPU Only | GPU (RTX 3090) |
|----------|----------|----------------|
| qwen2.5-coder:14b | 8-12 t/s | 45-60 t/s |
| deepseek-r1:14b | 6-10 t/s | 40-55 t/s |

**Quality** (subjective):

| Task | Cloud (Claude/GPT-4) | Local (qwen2.5-coder) |
|------|----------------------|------------------------|
| Code generation | ★★★★★ | ★★★★☆ |
| Code review | ★★★★★ | ★★★★☆ |
| RAG context | ★★★★☆ | ★★★★☆ |
| Complex reasoning | ★★★★★ | ★★★☆☆ |

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
  // Context generation
  enableContextGeneration: true,  // Enable LLM-based context (default: true)

  // Search pipeline
  enableBM25: true,               // Enable BM25 keyword search (default: true)
  enableReranking: true,          // Enable Cohere reranking (default: true)

  // Result configuration
  rerankTopN: 100,                // Candidates for reranking (default: 100)
  returnTopN: 8,                  // Initial results count (default: 8)
  maxTokensPerSearch: 3000,       // Token budget for results (default: 3000)

  // Caching
  enableCache: true,              // Cache embeddings (default: true)

  // Progress tracking
  onProgress: (msg) => console.log(msg),
});
```

**Token Budget Tuning**:

The `maxTokensPerSearch` parameter controls how many tokens of context are returned. This is critical for managing context window limits:

```typescript
// Conservative (for smaller context windows or many tool calls)
maxTokensPerSearch: 2000,

// Default (balanced)
maxTokensPerSearch: 3000,

// Aggressive (for large context windows, fewer tools)
maxTokensPerSearch: 5000,
```

Results are filtered using `gpt-tokenizer` to ensure they fit within budget, prioritizing highest-ranked chunks.

**Ollama-Optimized RAG**:

When using Ollama for context generation, adjust concurrency based on hardware:

```typescript
import { createCodebaseRAG } from '@agent/core';

const rag = createCodebaseRAG(workspaceRoot, {
  enableContextGeneration: true,
  returnTopN: 6,                  // Fewer results for faster processing
  maxTokensPerSearch: 2500,       // Conservative budget for local models
});

// Context generation uses models.fast() which respects OLLAMA_ENABLED
// No additional configuration needed
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

### Server-side Device Management

#### Device Registry Integration

The server provides a WebSocket-based device registry for managing multiple connected devices.

**Creating a Custom Device Client**:

```typescript
import WebSocket from 'ws';
import type { DeviceCapabilities, DeviceAction, ActionResult } from '@agent/shared';

class DeviceClient {
  private ws: WebSocket;
  private capabilities: DeviceCapabilities;

  constructor(serverUrl: string, capabilities: DeviceCapabilities) {
    this.capabilities = capabilities;
    this.ws = new WebSocket(serverUrl.replace('http', 'ws'));
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.on('open', () => {
        // Register device with server
        this.ws.send(JSON.stringify({
          type: 'device:register',
          capabilities: this.capabilities,
        }));
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.actionId && message.action) {
          this.handleAction(message.actionId, message.action);
        }
      });

      this.ws.on('error', reject);
    });
  }

  private async handleAction(actionId: string, action: DeviceAction): Promise<void> {
    try {
      const result = await this.executeAction(action);
      this.ws.send(JSON.stringify({
        type: 'action:result',
        actionId,
        result,
      }));
    } catch (error) {
      this.ws.send(JSON.stringify({
        type: 'action:result',
        actionId,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN',
        },
      }));
    }
  }

  private async executeAction(action: DeviceAction): Promise<ActionResult> {
    // Implement platform-specific action execution
    switch (action.type) {
      case 'tap':
        // Handle tap
        return { success: true };
      case 'screenshot':
        // Handle screenshot
        return {
          success: true,
          data: {
            type: 'screenshot',
            base64: '...',
            format: 'png',
            width: 1920,
            height: 1080,
          },
        };
      default:
        return { success: false, error: 'Not implemented', code: 'NOT_SUPPORTED' };
    }
  }
}

// Usage
const client = new DeviceClient('http://localhost:3000', {
  platform: 'desktop',
  deviceId: 'my-device-001',
  deviceName: 'Development Machine',
  screenSize: { width: 1920, height: 1080 },
  supportedActions: ['tap', 'type', 'screenshot', 'key'],
  hasKeyboard: true,
  hasUITree: false,
});

await client.connect();
```

**Device Action Timeout Configuration**:

The server uses a 30-second timeout for device actions. For long-running actions, implement progress reporting:

```typescript
// Server-side: Extend timeout for specific actions
const EXTENDED_TIMEOUT_ACTIONS = ['get_ui_tree', 'screenshot'];
const ACTION_TIMEOUT_MS = 30_000;
const EXTENDED_TIMEOUT_MS = 60_000;
```

### Streaming Response Configuration

#### Custom Streaming Client

Build a custom streaming client with fine-grained control:

```typescript
import { AgentClient, StreamingChatCallbacks } from '@agent/api-client';

class StreamingChatClient {
  private client: AgentClient;
  private currentText = '';
  private currentReasoning = '';
  private toolCalls: Map<string, ToolCallInfo> = new Map();

  constructor(baseUrl: string) {
    this.client = new AgentClient({ baseUrl });
  }

  async chat(message: string, options: StreamingOptions = {}): Promise<StreamingResult> {
    this.reset();

    const callbacks: StreamingChatCallbacks = {
      onStepStart: ({ stepIndex }) => {
        options.onStepStart?.(stepIndex);
      },

      onTextDelta: ({ delta }) => {
        this.currentText += delta;
        options.onTextUpdate?.(this.currentText);
      },

      onReasoningDelta: ({ delta }) => {
        this.currentReasoning += delta;
        options.onReasoningUpdate?.(this.currentReasoning);
      },

      onToolCall: (data) => {
        this.toolCalls.set(data.toolCallId, {
          ...data,
          status: 'running',
        });
        options.onToolStart?.(data.toolName, data.args);
      },

      onToolResult: (data) => {
        const call = this.toolCalls.get(data.toolCallId);
        if (call) {
          call.status = 'complete';
          call.result = data.result;
          call.durationMs = data.durationMs;
        }
        options.onToolComplete?.(data.toolName, data.result, data.durationMs);
      },

      onComplete: (data) => {
        options.onComplete?.(data);
      },

      onError: (data) => {
        options.onError?.(new Error(data.message));
      },
    };

    await this.client.streamMessageWithCallbacks(message, callbacks);

    return {
      text: this.currentText,
      reasoning: this.currentReasoning,
      toolCalls: Array.from(this.toolCalls.values()),
    };
  }

  private reset(): void {
    this.currentText = '';
    this.currentReasoning = '';
    this.toolCalls.clear();
  }
}
```

#### Server-Side Streaming Events

Customize streaming events on the server:

```typescript
import { createServer } from '@agent/server';

const { app, runtime } = await createServer();

// The server uses session.sendWithEvents() internally
// Events are emitted via SSE to the client

// Custom event handling example:
app.get('/sessions/:sessionId/chat/stream', (c) => {
  const session = sessions.get(c.req.param('sessionId'));
  const message = c.req.query('message');

  return streamSSE(c, async (stream) => {
    await session.sendWithEvents(message, async (event) => {
      // Transform or filter events before sending
      if (event.type === 'tool:call') {
        // Add custom metadata
        event.data = {
          ...event.data,
          serverTimestamp: Date.now(),
        };
      }

      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event.data),
      });
    });
  });
});
```

### Desktop App Advanced Usage

#### Custom Tauri Commands

Extend the desktop app with native capabilities:

```rust
// src-tauri/src/main.rs
#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_system_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
// src/app.tsx
import { invoke } from '@tauri-apps/api/tauri';

const systemInfo = await invoke('get_system_info');
```

#### Desktop-Specific Features

**Native Notifications**:
```typescript
import { sendNotification } from '@tauri-apps/api/notification';

sendNotification({
  title: 'Agent Response',
  body: 'Task completed successfully',
});
```

**File System Access**:
```typescript
import { open, save } from '@tauri-apps/api/dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';

// Open file picker
const filePath = await open({ filters: [{ name: 'Text', extensions: ['txt'] }] });

// Read file
const content = await readTextFile(filePath as string);

// Save file
const savePath = await save();
await writeTextFile(savePath as string, content);
```

#### Streaming with Desktop UI

Enhance the desktop app with real-time streaming:

```typescript
import { AgentClient } from '@agent/api-client';
import { useState, useCallback } from 'react';

function useStreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const clientRef = useRef<AgentClient | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const client = clientRef.current;
    if (!client) return;

    setIsStreaming(true);
    setCurrentText('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content }]);

    await client.streamMessageWithCallbacks(content, {
      onTextDelta: ({ delta }) => {
        setCurrentText(prev => prev + delta);
      },
      onComplete: ({ text }) => {
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        setCurrentText('');
        setIsStreaming(false);
      },
      onError: ({ message }) => {
        console.error('Stream error:', message);
        setIsStreaming(false);
      },
    });
  }, []);

  return { messages, currentText, isStreaming, sendMessage };
}
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

#### Ollama Performance Tuning

**CPU Optimization**:
```bash
# Set thread count (default: auto-detect)
export OLLAMA_NUM_THREADS=8

# Batch size (default: 512)
export OLLAMA_BATCH_SIZE=512
```

**GPU Optimization**:
```bash
# Enable GPU layers (default: -1 = all)
export OLLAMA_GPU_LAYERS=-1

# Multiple GPUs
export OLLAMA_NUM_GPU=2
```

**Memory Management**:
```bash
# Keep models in memory (faster subsequent calls)
export OLLAMA_KEEP_ALIVE=5m

# Context window size
export OLLAMA_NUM_CTX=4096
```

**Concurrent Requests**:
```bash
# Max concurrent requests (default: auto)
export OLLAMA_MAX_LOADED_MODELS=2
```

**Monitoring Performance**:
```typescript
import { logger } from '@agent/shared';

// Enable debug logging to see model performance
process.env.LOG_LEVEL = 'debug';

// Look for logs like:
// "🔌 Using Ollama model { tier: 'fast', model: 'qwen3:4b' }"
// "⏱️ [RAG] Query embedding generated { durationMs: '45.23' }"
```

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

#### Deploying with Ollama

**Docker Deployment**:

```dockerfile
FROM node:20-slim

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Copy application
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build

# Pull models during build
RUN ollama serve & \
    sleep 5 && \
    ollama pull qwen3:4b && \
    ollama pull nomic-embed-text

# Start both Ollama and application
CMD ollama serve & \
    sleep 5 && \
    node apps/cli/dist/cli.js
```

**Environment Variables for Production**:
```bash
# Use Ollama in production
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434/api

# Conservative model selection for stability
OLLAMA_FAST_MODEL=qwen3:4b
OLLAMA_STANDARD_MODEL=qwen2.5-coder:14b

# Optimize performance
OLLAMA_NUM_THREADS=8
OLLAMA_KEEP_ALIVE=30m
OLLAMA_NUM_CTX=4096

# Reduce RAG token budget for consistency
MAX_TOKENS_PER_SEARCH=2000
```

**Health Checks**:
```typescript
import { createOllama } from 'ollama-ai-provider-v2';

async function checkOllamaHealth() {
  try {
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
    });

    // Test with a simple generation
    const model = ollama('qwen3:4b');
    const result = await generateText({
      model,
      prompt: 'test',
      maxTokens: 10,
    });

    return { healthy: true, latencyMs: result.usage?.totalTime };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

**Scaling Considerations**:
- **Single Instance**: Run Ollama and app on same server (simpler)
- **Distributed**: Run Ollama on dedicated GPU servers, app instances connect via HTTP
- **Load Balancing**: Multiple Ollama instances behind load balancer for high throughput

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
