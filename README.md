# AI Agent Platform

A **server-side AI agent runtime** for Node.js applications built as a modern monorepo. Provides persistent memory, web search, shell execution, and codebase understanding through a modular package architecture.

> **⚠️ Server-Side Only**: This platform requires Node.js 20+ and uses native modules (SQLite, child_process). It cannot run in browsers. For frontend apps, run as a backend service and connect via HTTP/WebSocket.

## Monorepo Structure

This project uses pnpm workspaces and Turborepo for efficient package management:

```
agent-platform/
├── packages/
│   ├── shared/         # @agent/shared - Shared utilities & types
│   ├── core/           # @agent/core - Agent runtime engine
│   └── server/         # @agent/server - HTTP API server
├── apps/
│   └── cli/            # @agent/cli - CLI applications
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Packages

- **@agent/shared** - Base utilities (logger, performance tracking)
- **@agent/core** - Core agent runtime with memory, RAG, and tools
- **@agent/server** - Hono-based HTTP server with REST API and SSE streaming
- **@agent/cli** - Command-line interfaces (server launcher & interactive chat)

## Features

- **Persistent Memory**: Knowledge graph with automatic entity extraction (SQLite-based, zero config)
- **Web Intelligence**: Search (Brave/Tavily) and page parsing (Readability)
- **Shell Execution**: Full bash access for git, filesystem, and system operations
- **Optional Codebase Tools**: RAG-powered semantic search and grep (when workspace provided)
- **Session Management**: Multiple concurrent conversations with isolated history
- **HTTP Server**: Built-in Hono server with REST API
- **Programmatic API**: Import as a library or run as HTTP server
- **Turborepo Build System**: Lightning-fast builds with caching (< 1s with cache)

## Installation

### Prerequisites

- **Node.js 20+** (required)
- **pnpm 8+** (required for monorepo)
- **API Keys**:
  - [OpenRouter](https://openrouter.ai/) - LLM provider (required)
  - [Google AI](https://aistudio.google.com/apikey) - Embeddings (required)
  - [Brave Search](https://brave.com/search/api/) - Web search (optional)
  - [Tavily](https://tavily.com/) - Research search (optional)

### Quick Setup

```bash
# Clone repository
git clone <repo>
cd agent-platform

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Build all packages
pnpm build
```

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

### Interactive Chat

```bash
pnpm chat
```

### HTTP Server

```bash
pnpm server
```

Server starts on `http://localhost:3000` (or PORT env variable).

### As a Library

```typescript
import { createAgentRuntime } from '@agent/core';

const runtime = await createAgentRuntime();
const session = runtime.createSession();

const result = await session.send('What is the weather like in Tokyo?');
console.log(result.text);

await runtime.shutdown();
```

### With Codebase Access

```typescript
import { createAgentRuntime } from '@agent/core';

const runtime = await createAgentRuntime({
  workspaceRoot: '/path/to/project',  // Enables RAG + grep + validate tools
});

const session = runtime.createSession();
const result = await session.send('Find all TODO comments in the codebase');
```

### With User Interaction

```typescript
import { createAgentRuntime } from '@agent/core';

const runtime = await createAgentRuntime({
  askUserHandler: async (question) => {
    // Called when agent needs user input
    return await promptUser(question);
  },
});
```

## HTTP Server API

The `@agent/server` package provides a Hono-based HTTP server.

### Endpoints

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

### Client Example

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

## Available Scripts

### Root Scripts

```bash
pnpm build          # Build all packages with Turborepo
pnpm dev           # Run all packages in dev mode
pnpm test          # Run all tests
pnpm lint          # Lint all packages
pnpm clean         # Clean all build artifacts
pnpm chat          # Start interactive chat CLI
pnpm server        # Start HTTP server
```

### Per-Package Scripts

```bash
# Build specific package
pnpm --filter @agent/core build

# Test specific package
pnpm --filter @agent/core test

# Add dependency to specific package
pnpm --filter @agent/core add <package>
```

## Tools

### Always Available (11 tools)

| Tool | Description |
|------|-------------|
| `shell` | Execute bash commands |
| `web_search` | Search the internet (Brave/Tavily) |
| `fetch_page` | Fetch and parse web pages |
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
| `search_codebase` | Semantic search over indexed code and documents |
| `grep_codebase` | Regex pattern matching in files |
| `validate` | Run TypeScript checks and tests |

**RAG (Retrieval-Augmented Generation)**: The workspace indexing uses a pluggable strategy system that automatically selects the appropriate chunking method based on file type:

- **Code files** (`.ts`, `.js`, `.py`, `.java`, `.go`, `.rs`, `.c`, `.cpp`, `.h`) - AST-based chunking via `code-chopper`
- **Documents** (`.md`, `.txt`, `.markdown`) - Semantic chunking by headings/paragraphs
- **Custom strategies** - Easily add support for new file types (PDFs, etc.)

See [packages/core/src/core/rag/strategies/README.md](packages/core/src/core/rag/strategies/README.md) for details on creating custom chunking strategies.

## Memory System

The agent includes a persistent knowledge graph that automatically extracts memories from conversations:

- **Automatic extraction** - Memories are extracted from user/agent dialogue when tasks complete
- **Extracts entities** using LLM (people, projects, concepts)
- **Tracks relationships** between entities
- **Stores facts** with temporal validity (validFrom/validTo)
- **Enables semantic search** using embeddings
- **Persists to SQLite** (zero configuration required)

### Memory Persistence

Memory is stored in SQLite by default at `./memory.db`. The database persists across sessions:

```typescript
// Session 1: User discusses their project
await session.send('Help me set up auth for my Next.js app, I prefer Clerk');
// Memories automatically extracted: user prefers Clerk, project uses Next.js

// Session 2 (later, even after restart)
await session.send('What auth library should I use?');
// Agent recalls preferences from memory
```

### Optional: Graphiti Backend

For production deployments requiring Neo4j-backed graph memory:

```bash
docker compose -f docker/graphiti-compose.yml up -d
```

Set `GRAPHITI_URL=http://localhost:8000` and the agent auto-detects it.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│  Web App    │ Mobile App  │ Desktop App │    CLI      │  Third-party│
│  (Next.js)  │(React Native)│  (Tauri)   │             │  (via API)  │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       └─────────────┴─────────────┼─────────────┴─────────────┘
                                   │
                          HTTP/WebSocket
                                   │
                    ┌──────────────▼──────────────┐
                    │    @agent/server (Hono)     │
                    │   Session Management API    │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      @agent/core            │
                    │    Agent Runtime Engine     │
                    ├──────────────────────────────┤
                    │  Memory │ Tools │ Orchestrator│
                    └──────────────┬──────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
┌──────▼──────┐            ┌───────▼───────┐          ┌───────▼───────┐
│   LLM API   │            │  External APIs │          │  @agent/shared│
│ (OpenRouter)│            │(Brave, Tavily) │          │   (Utils)     │
└─────────────┘            └───────────────┘          └───────────────┘
```

## Development

### Building

```bash
# Build all packages (with Turborepo caching)
pnpm build

# Build specific package
pnpm --filter @agent/core build

# Clean and rebuild
pnpm clean && pnpm build
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @agent/core test

# Watch mode
pnpm --filter @agent/core test --watch
```

### Development Workflow

1. Make changes to source files in any package
2. Run `pnpm build` to compile TypeScript
3. Test with `pnpm chat` or `pnpm server`
4. Run tests with `pnpm test`

Turborepo automatically handles build dependencies - if you change `@agent/shared`, it will rebuild all dependent packages.

### Package Structure

```
packages/
├── shared/
│   ├── src/
│   │   ├── logger.ts
│   │   ├── performance.ts
│   │   └── index.ts
│   ├── dist/
│   ├── package.json
│   └── tsconfig.json
│
├── core/
│   ├── src/
│   │   ├── runtime/           # Agent execution engine
│   │   ├── application/       # Orchestrator & initialization
│   │   ├── core/
│   │   │   ├── agents/        # Model configs
│   │   │   ├── memory/        # Knowledge graph
│   │   │   ├── rag/           # Semantic search
│   │   │   └── search/        # Grep utilities
│   │   ├── tools/             # Tool implementations
│   │   ├── infrastructure/    # System prompts
│   │   └── index.ts
│   ├── dist/
│   ├── package.json
│   └── tsconfig.json
│
├── server/
│   ├── src/
│   │   └── index.ts           # Hono server
│   ├── dist/
│   ├── package.json
│   └── tsconfig.json
│
apps/cli/
├── src/
│   ├── server.ts              # Server launcher
│   └── chat.ts                # Interactive chat
├── dist/
├── package.json
└── tsconfig.json
```

## Security

⚠️ This agent has full shell access and can execute arbitrary commands. Only run in trusted environments:

- Use in containerized/sandboxed environments
- Limit filesystem access via workspace boundaries
- Never expose directly to untrusted users
- Consider command allowlists for production

## Roadmap

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete architecture evolution plan, including:

- ✅ **Phase 1**: Monorepo structure (Complete)
- **Phase 2**: Device use package (macOS, Linux, Windows, iOS, Android)
- **Phase 3**: React Native mobile app
- **Phase 4**: Tauri desktop app
- **Phase 5**: Next.js web dashboard

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT
