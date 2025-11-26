# ai-agent-runtime

A **server-side AI agent runtime** for Node.js applications. Provides persistent memory, web search, shell execution, and optional codebase understanding. Designed as a library that can be embedded in backend services or run as a standalone HTTP server.

> **⚠️ Server-Side Only**: This package requires Node.js 20+ and uses native modules (SQLite, child_process). It cannot run in browsers. For frontend apps, run as a backend service and connect via HTTP/WebSocket.

## Features

- **Persistent Memory**: Knowledge graph with automatic entity extraction (SQLite-based, zero config)
- **Web Intelligence**: Search (Brave/Tavily) and page parsing (Readability)
- **Shell Execution**: Full bash access for git, filesystem, and system operations
- **Optional Codebase Tools**: RAG-powered semantic search and grep (when workspace provided)
- **Session Management**: Multiple concurrent conversations with isolated history
- **HTTP Server**: Built-in Hono server with REST API
- **Programmatic API**: Import as a library or run as HTTP server

## Installation

```bash
npm install ai-agent-runtime
# or
pnpm add ai-agent-runtime
```

### Prerequisites

- **Node.js 20+** (required)
- **API Keys**:
  - [OpenRouter](https://openrouter.ai/) - LLM provider (required)
  - [Google AI](https://aistudio.google.com/apikey) - Embeddings (required)
  - [Brave Search](https://brave.com/search/api/) - Web search (optional)
  - [Tavily](https://tavily.com/) - Research search (optional)

### Environment Variables

```env
# Required
OPENROUTER_API_KEY=sk-or-v1-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Optional - Web Search
BRAVE_API_KEY=BSA...
TAVILY_API_KEY=tvly-...

# Optional - Memory
MEMORY_DB_PATH=./memory.db  # Default location for SQLite

# Optional - Model Selection
MODEL_STANDARD=google/gemini-2.0-flash-001
MODEL_EXTRACTION=google/gemini-2.0-flash-001
```

## Quick Start

### As a Library

```typescript
import { createAgentRuntime } from 'ai-agent-runtime';

const runtime = await createAgentRuntime();
const session = runtime.createSession();

const result = await session.send('What is the weather like in Tokyo?');
console.log(result.text);

await runtime.shutdown();
```

### With Codebase Access

```typescript
import { createAgentRuntime } from 'ai-agent-runtime';

const runtime = await createAgentRuntime({
  workspaceRoot: '/path/to/project',  // Enables RAG + grep + validate tools
});

const session = runtime.createSession();
const result = await session.send('Find all TODO comments in the codebase');
```

### With User Interaction

```typescript
import { createAgentRuntime } from 'ai-agent-runtime';

const runtime = await createAgentRuntime({
  askUserHandler: async (question) => {
    // Called when agent needs user input
    return await promptUser(question);
  },
});
```

## API Reference

### `createAgentRuntime(config?)`

Creates an agent runtime instance.

```typescript
interface AgentConfig {
  workspaceRoot?: string;           // Path to index for codebase tools
  askUserHandler?: (question: string) => Promise<string>;
}
```

**Returns**: `Promise<AgentRuntime>`

### `AgentRuntime`

```typescript
interface AgentRuntime {
  createSession(): AgentSession;    // Create a new conversation
  shutdown(): Promise<void>;        // Cleanup resources
}
```

### `AgentSession`

```typescript
interface AgentSession {
  send(message: string): Promise<TaskResult>;
  runTask(input: TaskInput): Promise<TaskResult>;
  getHistory(): ModelMessage[];
  clearHistory(): void;
}
```

### `TaskResult`

```typescript
interface TaskResult {
  text: string;              // Agent's response
  messages: ModelMessage[];  // Full conversation history
  completed: boolean;        // true if task_complete was called
  needsInput: boolean;       // true if ask_user was called
  pendingQuestion?: string;  // Question for user (if needsInput)
  stepsUsed: number;         // Number of reasoning steps
  toolsUsed: string[];       // Tools invoked
}
```

### HTTP Server

```typescript
import { createServer, startServer, type ServerConfig } from 'ai-agent-runtime';

interface ServerConfig {
  port?: number;              // Default: 3000 or PORT env
  workspaceRoot?: string;     // Path for codebase tools
  corsOrigin?: string | string[];  // CORS origins
}

// Option 1: Start server directly
await startServer({ port: 3000 });

// Option 2: Get Hono app for custom setup
const { app, runtime, port } = await createServer();
```

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (`{ status: 'ok' }`) |
| `POST` | `/sessions` | Create session → `{ sessionId }` |
| `DELETE` | `/sessions/:id` | Delete session |
| `POST` | `/sessions/:id/chat` | Send message → `{ text, completed, ... }` |
| `GET` | `/sessions/:id/chat/stream` | SSE streaming (query: `?message=...`) |
| `GET` | `/sessions/:id/history` | Get message history |
| `POST` | `/sessions/:id/clear` | Clear session history |
| `POST` | `/chat` | Convenience: auto-creates session |

#### CLI

```bash
# Run as standalone server
npx ai-agent-server

# With environment variables
PORT=8080 WORKSPACE_ROOT=/path/to/project npx ai-agent-server
```

## Tools

### Always Available (12 tools)

| Tool | Description |
|------|-------------|
| `shell` | Execute bash commands |
| `web_search` | Search the internet (Brave/Tavily) |
| `fetch_page` | Fetch and parse web pages |
| `memory_add` | Store information with entity extraction |
| `memory_search` | Semantic search over stored knowledge |
| `memory_get_episodes` | Get recent conversation episodes |
| `memory_get_fact` | Retrieve specific fact by ID |
| `memory_get_entity` | Get entity details by ID |
| `memory_get_related` | Find related entities via graph |
| `plan` | Create and track multi-step plans |
| `ask_user` | Request user input |
| `task_complete` | Signal task completion |

### Workspace Tools (3 tools, when `workspaceRoot` provided)

| Tool | Description |
|------|-------------|
| `search_codebase` | Semantic search over indexed code |
| `grep_codebase` | Regex pattern matching in files |
| `validate` | Run TypeScript checks and tests |

## Memory System

The agent includes a persistent knowledge graph that:

- **Extracts entities** automatically using LLM (people, projects, concepts)
- **Tracks relationships** between entities
- **Stores facts** with temporal validity (validFrom/validTo)
- **Enables semantic search** using embeddings
- **Persists to SQLite** (zero configuration required)

### Memory Persistence

Memory is stored in SQLite by default at `./memory.db`. The database persists across sessions:

```typescript
// Session 1
await session.send('Remember that Randy created this project');

// Session 2 (later, even after restart)
await session.send('Who created this project?');
// Agent recalls: "Randy created this project"
```

### Optional: Graphiti Backend

For production deployments requiring Neo4j-backed graph memory:

```bash
docker compose -f docker/graphiti-compose.yml up -d
```

Set `GRAPHITI_URL=http://localhost:8000` and the agent auto-detects it.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Your Application                           │
│           (Hono, Fastify, or any Node.js backend)              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                       Agent Runtime                             │
│                   createAgentRuntime()                          │
├─────────────────────────────────────────────────────────────────┤
│  Sessions     │  Tools           │  Memory          │  RAG      │
│  - History    │  - shell         │  - Entities      │  - Index  │
│  - Context    │  - web_search    │  - Relations     │  - Search │
│               │  - memory_*      │  - Facts         │  - Chunks │
└─────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      External Services                          │
│  OpenRouter (LLM)  │  Google (Embeddings)  │  Brave/Tavily     │
└─────────────────────────────────────────────────────────────────┘
```

## Examples

### Built-in HTTP Server

```typescript
import { startServer } from 'ai-agent-runtime';

await startServer({
  port: 3000,
  workspaceRoot: '/path/to/project',  // Optional
  corsOrigin: ['http://localhost:5173'],  // Optional
});
```

### Client Usage (fetch)

```typescript
const API = 'http://localhost:3000';

const { sessionId } = await fetch(`${API}/sessions`, { method: 'POST' }).then(r => r.json());

const response = await fetch(`${API}/sessions/${sessionId}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'What is the weather in Tokyo?' }),
}).then(r => r.json());

console.log(response.text);
```

### Background Worker

```typescript
import { createAgentRuntime } from 'ai-agent-runtime';

const runtime = await createAgentRuntime({
  workspaceRoot: process.env.PROJECT_PATH,
});

async function processTask(task: string) {
  const session = runtime.createSession();
  const result = await session.send(task);

  if (result.completed) {
    return { success: true, output: result.text };
  }

  return { success: false, output: result.text };
}
```

### CLI Tool

```typescript
import { createAgentRuntime } from 'ai-agent-runtime';
import * as readline from 'readline/promises';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const runtime = await createAgentRuntime({
  askUserHandler: async (question) => {
    return await rl.question(`Agent asks: ${question}\n> `);
  },
});

const session = runtime.createSession();

while (true) {
  const input = await rl.question('You: ');
  if (input === 'exit') break;

  const result = await session.send(input);
  console.log(`Agent: ${result.text}\n`);
}

await runtime.shutdown();
```

## Development

```bash
# Clone and install
git clone <repo>
pnpm install

# Configure
cp .env.example .env
# Edit .env with your API keys

# Test interactively
pnpm chat

# Build
pnpm build

# Run tests
pnpm test
```

### Project Structure

```
src/
├── index.ts              # Library exports
├── chat.ts               # Interactive CLI for testing
├── runtime/
│   └── agent-runtime.ts  # Main runtime implementation
├── tools/                # Tool implementations
│   ├── shell.ts
│   ├── web-search.ts
│   ├── fetch-page.ts
│   ├── memory.ts
│   ├── codebase.ts
│   ├── workflow.ts
│   └── agent.ts
├── core/
│   ├── memory/           # Knowledge graph (SQLite)
│   └── rag/              # Codebase indexing
└── application/
    ├── initialization.ts
    └── orchestrator.ts
```

## Security

⚠️ This agent has full shell access and can execute arbitrary commands. Only run in trusted environments:

- Use in containerized/sandboxed environments
- Limit filesystem access via workspace boundaries
- Never expose directly to untrusted users
- Consider command allowlists for production

## License

MIT
