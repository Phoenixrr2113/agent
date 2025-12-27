# AI Agent Platform

[![CI](https://github.com/Phoenixrr2113/agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Phoenixrr2113/agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8-orange)](https://pnpm.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A **server-side AI agent runtime** for Node.js applications built as a modern monorepo. Provides persistent memory, web search, shell execution, and codebase understanding through a modular package architecture.

> **⚠️ Server-Side Only**: This platform requires Node.js 20+ and uses native modules (SQLite, child_process). It cannot run in browsers. For frontend apps, run as a backend service and connect via HTTP/WebSocket.

## Monorepo Structure

This project uses pnpm workspaces and Turborepo for efficient package management:

```
agent-platform/
├── packages/
│   ├── shared/               # @agent/shared - Shared utilities & types
│   ├── core/                 # @agent/core - Agent runtime engine
│   ├── memory/               # @agent/memory - Memory, RAG, profiles, embeddings
│   ├── server/               # @agent/server - HTTP API server
│   ├── device-use/           # @agent/device-use - Cross-platform device control
│   ├── api-client/           # @agent/api-client - HTTP/WebSocket client
│   ├── ui/                   # @agent/ui - Shared React Native components
│   ├── tailwind-config/      # @agent/tailwind-config - Shared Tailwind config
│   ├── mobile-accessibility/ # @agent/mobile-accessibility - Android accessibility
│   └── benchmarks/           # @agent/benchmarks - Benchmark adapters
├── apps/
│   ├── cli/                  # @agent/cli - CLI applications
│   └── expo/                 # @agent/expo - Mobile/Web app
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Packages

- **@agent/shared** - Shared types, utilities (logger, performance), streaming events
- **@agent/core** - Core agent runtime with tool orchestration and LLM integration
- **@agent/memory** - Memory system with RAG, user profiles, entity extraction, and embeddings
- **@agent/server** - Hono-based HTTP/WebSocket server with REST API, SSE streaming, API key auth, and real-time dashboard
- **@agent/device-use** - Cross-platform device control (nut.js for desktop, Playwright for web, mobile drivers)
- **@agent/api-client** - HTTP and WebSocket client for connecting to the agent server
- **@agent/ui** - Shared React Native UI components with NativeWind styling
- **@agent/tailwind-config** - Shared Tailwind CSS configuration for web and native
- **@agent/mobile-accessibility** - Native Android accessibility service integration
- **@agent/benchmarks** - Benchmark adapters for HAL, τ-bench, GAIA, and SWE-bench

### Apps

- **@agent/cli** - Command-line tools (server launcher & interactive chat REPL)
- **@agent/expo** - Cross-platform mobile/web app with chat, device control, and debug dashboard

## Features

- **Persistent Memory**: Knowledge graph with automatic entity extraction (SQLite-based, zero config)
- **Web Intelligence**: Search (Brave/Tavily) and page parsing (Readability)
- **Shell Execution**: Full bash access for git, filesystem, and system operations
- **Device Control**: High-performance cross-platform automation via nut.js (100x faster than CLI tools, Wayland support)
- **Filesystem Tools**: 12 comprehensive file operations (read, write, edit, search, move, metadata)
- **Smart Tool Management**: Deferred loading with semantic search and dynamic activation
- **Sequential Thinking**: Multi-step reasoning with branching and revision support
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
pnpm dev            # Run all packages in dev mode
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm clean          # Clean all build artifacts
pnpm chat           # Start interactive chat CLI
pnpm server         # Start HTTP server
pnpm expo           # Start Expo development server
pnpm expo:web       # Run Expo app in web browser
pnpm expo:ios       # Run Expo app on iOS simulator
pnpm expo:android   # Run Expo app on Android emulator
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

The agent provides a comprehensive set of tools that are all loaded at initialization. Tools use a unified action-based design where related operations are grouped into single tools with action parameters.

### Core Tools

| Tool | Description |
|------|-------------|
| `fs` | Unified filesystem operations (read, write, edit, list, glob, grep, move, delete, info, mkdir) |
| `shell` | Execute bash commands with full system access |
| `web` | Web search and page fetching (search via Brave/Tavily, fetch with Readability) |
| `memory` | Knowledge graph operations (add, search, episodes, fact, entity, related) |
| `plan` | Create and track multi-step plans with task breakdown |
| `validate` | Run TypeScript checks and tests |
| `sequential_thinking` | Complex reasoning with branching and revision support |
| `delegate` | Delegate subtasks to specialized sub-agents |
| `task` | Create and manage background tasks |

### Agent Interaction Tools

| Tool | Description |
|------|-------------|
| `task_complete` | Signal task completion and end execution |
| `ask_user` | Request user input or clarification |

### Codebase Tools (when `workspaceRoot` provided)

| Tool | Description |
|------|-------------|
| `search_codebase` | Semantic search over indexed code and documents using RAG |

### Device Control Tools

| Tool | Description |
|------|-------------|
| `list_devices` | List all connected devices (desktop, mobile, web) |
| `select_device` | Select a device to control |
| `device_action` | Execute actions (tap, swipe, type, screenshot, get_ui_tree) |
| `tap` | Tap at coordinates on selected device |
| `type_text` | Type text on selected device |
| `device_screenshot` | Take screenshot of selected device |
| `swipe` | Swipe gesture on selected device |

### Unified Tool Design

Tools use an action-based pattern for related operations:

**Filesystem Tool (`fs`)** - Actions: `read`, `write`, `edit`, `list`, `glob`, `grep`, `move`, `delete`, `info`, `mkdir`
```typescript
// Read a file
{ action: 'read', path: '/path/to/file.ts' }

// Edit with find/replace
{ action: 'edit', path: '/path/to/file.ts', old_string: 'foo', new_string: 'bar' }

// Search files by pattern
{ action: 'glob', path: '/project', pattern: '**/*.test.ts' }
```

**Web Tool (`web`)** - Actions: `search`, `fetch`
```typescript
// Search the web
{ action: 'search', query: 'TypeScript best practices', engine: 'tavily' }

// Fetch and parse a page
{ action: 'fetch', url: 'https://example.com/docs' }
```

**Memory Tool (`memory`)** - Actions: `add`, `search`, `episodes`, `fact`, `entity`, `related`
```typescript
// Store information
{ action: 'add', content: 'User prefers TypeScript', groupId: 'preferences' }

// Search memory
{ action: 'search', query: 'user preferences' }

// Get related entities
{ action: 'related', entityId: 'user-123', depth: 2 }
```

**RAG (Retrieval-Augmented Generation)**: The workspace indexing uses a pluggable strategy system that automatically selects the appropriate chunking method based on file type:

- **Code files** (`.ts`, `.js`, `.py`, `.java`, `.go`, `.rs`, `.c`, `.cpp`, `.h`) - AST-based chunking via `code-chopper`
- **Documents** (`.md`, `.txt`, `.markdown`) - Semantic chunking by headings/paragraphs
- **Custom strategies** - Easily add support for new file types (PDFs, etc.)

See [packages/memory/src/rag/strategies/README.md](packages/memory/src/rag/strategies/README.md) for details on creating custom chunking strategies.

### Tool Usage Examples

#### Filesystem Operations

```typescript
const runtime = await createAgentRuntime({ workspaceRoot: '/path/to/project' });
const session = runtime.createSession();

// Read a file
await session.send('Read the package.json file');

// Edit a file with find/replace
await session.send('Replace "version": "1.0.0" with "version": "2.0.0" in package.json');

// Search for files
await session.send('Find all TypeScript test files');

// Create a directory and write files
await session.send('Create a new feature directory with index.ts and tests');

// Get file metadata
await session.send('Show me file info for the largest files in src/');
```

#### Sequential Thinking

The `sequential_thinking` tool enables complex multi-step reasoning:

```typescript
// Agent automatically uses sequential thinking for complex tasks
await session.send('Analyze the performance bottlenecks in this codebase and suggest optimizations');

// The agent will:
// 1. Think through the problem (Thought 1/5)
// 2. Search codebase for performance patterns
// 3. Continue reasoning (Thought 2/5)
// 4. Identify specific issues
// 5. Revise earlier thoughts if needed
// 6. Provide final recommendations
```

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
├────────────────────┬─────────────┬─────────────┬────────────────────┤
│   Expo App         │ Desktop App │    CLI      │     Third-party    │
│ (iOS/Android/Web)  │   (Tauri)   │             │     (via API)      │
└─────────┬──────────┴──────┬──────┴──────┬──────┴─────────┬──────────┘
          │                 │             │                │
          │     ┌───────────┴─────────────┴────────────────┘
          │     │
          │     │       @agent/api-client
          │     │       (HTTP/WebSocket)
          │     │
          └─────┴───────────────┐
                                │
                    ┌───────────▼───────────────┐
                    │    @agent/server (Hono)   │
                    │   HTTP + WebSocket API    │
                    │   Dashboard + Streaming   │
                    └───────────┬───────────────┘
                                │
                    ┌───────────▼───────────────┐
                    │      @agent/core          │
                    │   Agent Runtime Engine    │
                    ├───────────────────────────┤
                    │ Memory │ RAG │ Tools      │
                    │ Embeddings │ Orchestrator │
                    └───────────┬───────────────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
┌──────▼──────┐         ┌───────▼───────┐       ┌───────▼───────┐
│   LLM APIs  │         │ @agent/device │       │ External APIs │
│  (Multiple) │         │  (nut.js/     │       │ (Brave/Tavily)│
│             │         │   Playwright) │       │               │
└─────────────┘         └───────────────┘       └───────────────┘

Shared Infrastructure:
┌────────────────┬─────────────────┬──────────────────────┐
│ @agent/shared  │ @agent/ui       │ @agent/tailwind-cfg  │
│ (Types/Utils)  │ (Components)    │ (Styling)            │
└────────────────┴─────────────────┴──────────────────────┘
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
├── shared/                   # Shared utilities and types
│   └── src/
│       ├── utils/            # Logger, performance
│       ├── streaming/        # Stream event types
│       ├── dashboard/        # Dashboard events
│       └── device/           # Device action schemas
│
├── core/                     # Agent runtime engine
│   └── src/
│       ├── runtime/          # Agent execution engine
│       ├── application/      # Orchestrator & initialization
│       ├── agents/           # Model configs and roles
│       ├── tools/            # Tool implementations with middleware
│       │   └── middleware/   # Tool activation, lifecycle, instrumentation
│       └── infrastructure/   # System prompts
│
├── memory/                   # Memory, RAG, profiles, embeddings
│   └── src/
│       ├── embeddings/       # Embedding models and similarity
│       ├── entities/         # Entity extraction and storage
│       ├── profiles/         # User profile management
│       ├── rag/              # Semantic search with chunking strategies
│       │   └── strategies/   # Pluggable chunking (code, document)
│       └── storage/          # SQLite and memory storage adapters
│
├── server/                   # HTTP/WebSocket server
│   └── src/
│       ├── auth/             # API key authentication
│       ├── devices/          # Device registry
│       └── index.ts          # Hono server with dashboard
│
├── api-client/               # Client SDK
│   └── src/
│       ├── http-client.ts    # HTTP client
│       ├── websocket-client.ts # WebSocket client
│       └── index.ts          # Unified client
│
├── device-use/               # Device control
│   └── src/
│       ├── drivers/          # Desktop, Android, Web drivers
│       ├── tools.ts          # Device tools
│       └── utils/safety.ts   # Safety validation
│
├── ui/                       # Shared UI components
│   └── src/
│       ├── components/       # Button, Text, Surface, etc.
│       ├── chat/             # Chat-specific components
│       └── debug/            # Debug dashboard components
│
├── mobile-accessibility/     # Android native module
│   ├── android/              # Native Kotlin code
│   └── index.ts              # TypeScript bindings
│
├── benchmarks/               # Benchmark adapters
│   └── src/
│       ├── hal/              # HAL adapter
│       ├── tau-bench/        # τ-bench adapter
│       └── custom/           # Custom benchmark suite
│
└── tailwind-config/          # Shared Tailwind config
    └── src/
        ├── base.ts           # Base theme
        ├── web-preset.ts     # Web preset
        └── native-preset.ts  # Native preset

apps/
├── cli/                      # CLI tools
│   └── src/
│       ├── cli.ts            # Server launcher
│       └── chat.ts           # Interactive chat REPL
│
└── expo/                     # Mobile/Web app
    └── app/
        ├── (tabs)/           # Tab navigation
        │   ├── index.tsx     # Home/Chat
        │   ├── chat.tsx      # Chat interface
        │   ├── settings.tsx  # Settings screen
        │   └── debug.tsx     # Debug dashboard
        └── _layout.tsx       # Root layout
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
- ✅ **Phase 2**: Device use package (Complete - macOS, Linux, Windows, Android)
- ✅ **Phase 3**: Expo mobile/web app (Complete - iOS, Android, Web with debug dashboard)
- **Phase 4**: Tauri desktop app
- **Phase 5**: Production deployment infrastructure

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT
