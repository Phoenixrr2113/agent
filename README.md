# AI Agent Platform

[![CI](https://github.com/Phoenixrr2113/agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Phoenixrr2113/agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8-orange)](https://pnpm.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A **full-stack AI agent platform** built as a modern monorepo. Includes a Node.js server with multi-user authentication, client SDKs, and example applications for mobile, web, and CLI. Features persistent memory, web search, shell execution, device control, and codebase understanding.

## What's Included

- **Server** (`@agent/server`) - HTTP/WebSocket API with multi-user auth, SSE streaming, and real-time dashboard
- **Client SDK** (`@agent/api-client`) - HTTP and WebSocket clients for connecting to the server
- **UI Components** (`@agent/ui`) - Shared React Native components for building agent interfaces
- **Example Apps**:
  - **Expo App** (`@agent/expo`) - Cross-platform mobile/web app (iOS, Android, Web)
  - **CLI** (`@agent/cli`) - Command-line chat REPL and server launcher
- **Core Runtime** (`@agent/core`) - Can also be used directly as a library in Node.js applications

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

- **Multi-User Server**: API key authentication with per-user agent runtimes and sessions
- **Cross-Platform Apps**: Example Expo app runs on iOS, Android, and Web
- **Persistent Memory**: Knowledge graph with automatic entity extraction (SQLite-based, zero config)
- **Web Intelligence**: Search (Brave/Tavily) and page parsing (Readability)
- **Shell Execution**: Full bash access for git, filesystem, and system operations
- **Device Control**: High-performance cross-platform automation via nut.js and accessibility services
- **Unified Tools**: Action-based tools for filesystem, web, memory, and device operations
- **Sequential Thinking**: Multi-step reasoning with branching and revision support
- **Codebase RAG**: Semantic search over indexed code (when workspace provided)
- **Session Management**: Multiple concurrent conversations with isolated history
- **Real-time Dashboard**: WebSocket-based dashboard for monitoring agent activity
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

### Run the Server

```bash
# Start the agent server
pnpm server
```

Server starts on `http://localhost:3000`. Create an API key to authenticate:

```bash
curl -X POST http://localhost:3000/api-keys -H "Content-Type: application/json" -d '{"name": "my-key"}'
```

### Run the Expo App

```bash
# Start the Expo development server
pnpm --filter @agent/expo start

# Or run directly on platforms
pnpm --filter @agent/expo web      # Web browser
pnpm --filter @agent/expo ios      # iOS simulator
pnpm --filter @agent/expo android  # Android emulator
```

### Interactive CLI Chat

```bash
pnpm chat
```

### Use as a Library

```typescript
import { createAgentRuntime } from '@agent/core';

const runtime = await createAgentRuntime({
  workspaceRoot: '/path/to/project',
});
const session = runtime.createSession();

const result = await session.send('What files are in this project?');
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

The `@agent/server` package provides a Hono-based HTTP/WebSocket server with multi-user authentication.

### Authentication

Protected endpoints require an API key via the `Authorization` header:

```bash
# Create an API key (no auth required)
curl -X POST http://localhost:3000/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app"}'
# Returns: { "key": "ak_...", "name": "my-app" }

# Use the key for authenticated requests
curl http://localhost:3000/sessions \
  -H "Authorization: Bearer ak_..."
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/api-keys` | No | Create API key |
| `GET` | `/api-keys` | Yes | List API keys |
| `DELETE` | `/api-keys/:hash` | Yes | Revoke API key |
| `POST` | `/sessions` | Yes | Create session |
| `DELETE` | `/sessions/:id` | No | Delete session |
| `POST` | `/sessions/:id/chat` | No | Send message |
| `GET` | `/sessions/:id/chat/stream` | No | SSE streaming |
| `GET` | `/sessions/:id/history` | No | Get history |
| `POST` | `/sessions/:id/clear` | No | Clear history |
| `POST` | `/chat` | Yes | Auto-creates session |
| `GET` | `/devices` | No | List connected devices |
| `POST` | `/devices/:id/action` | No | Execute device action |
| `GET` | `/dashboard/state` | No | Dashboard snapshot |
| `WS` | `/dashboard/ws` | No | Real-time dashboard |

### Client SDK Example

```typescript
import { AgentClient } from '@agent/api-client';

const client = new AgentClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'ak_...',
});

// Create session and send message
const session = await client.createSession();
const response = await client.chat(session.sessionId, 'Hello!');
console.log(response.text);

// Or use streaming
await client.chatStream(session.sessionId, 'Tell me a story', {
  onTextDelta: (delta) => process.stdout.write(delta),
  onComplete: (result) => console.log('\nDone!'),
});
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

The memory system was built from first principles to understand how frontier AI labs approach agent memory. It implements the full retrieval pipeline: chunking → contextual embeddings → hybrid search → reranking.

### Hybrid Search Architecture

The search engine combines multiple retrieval methods for optimal recall:

```
Query → [BM25 Lexical Search] ──┐
                                ├─→ [Reciprocal Rank Fusion] → [Cohere Reranking] → Results
Query → [Semantic Embeddings] ──┘
```

1. **BM25 Lexical Search** - Classic term-frequency search with configurable field weights:
   - Content weight: 1.0, Name weight: 2.0, FilePath weight: 0.5
   - Parameters: k1=1.2, b=0.75 (tuned for code search)

2. **Semantic Embedding Search** - Google's text-embedding-004 with cosine similarity

3. **Reciprocal Rank Fusion (RRF)** - Merges BM25 and embedding results with weighted scoring:
   ```typescript
   score = (embeddingWeight / (k + embeddingRank)) + (bm25Weight / (k + bm25Rank))
   ```

4. **Cohere Reranking** - Final pass using `rerank-v3.5` model for precision

### Contextual Embeddings

Each code chunk is processed through an LLM before embedding to generate rich metadata:

```typescript
// Before embedding, each chunk gets an LLM-generated description:
{
  filePath: "src/auth/session.ts",
  content: "export class SessionManager { ... }",
  context: "Defines SessionManager class that handles user session lifecycle,
            including creation, validation, and expiration. Uses JWT tokens
            for authentication and Redis for session storage.",
  contextualContent: "File: src/auth/session.ts\nScope: module\nName: SessionManager\n
                      Description: Defines SessionManager class...\n\n[actual code]"
}
```

This "contextual retrieval" technique dramatically improves search relevance by giving embeddings semantic understanding of code purpose, not just syntax.

### Knowledge Graph Memory

The entity memory system extracts and manages knowledge from conversations:

- **Entity Extraction** - LLM identifies people, projects, concepts, preferences from dialogue
- **Relation Tracking** - Graph connections between entities (user → prefers → TypeScript)
- **Fact Temporal Validity** - Facts have `validFrom`/`validTo` timestamps; new facts can supersede old ones
- **Batch Contradiction Detection** - When adding new facts, the system detects and invalidates contradicting existing facts
- **Entity Conflict Resolution** - When entities with the same name appear, LLM determines if they should merge

### User Profiles

Separate from the knowledge graph, user profiles track preferences and inject contextual reminders into tool calls:

```typescript
// Profile extracted from conversation:
{
  userId: "user-123",
  preferences: [
    { key: "language", value: "TypeScript", confidence: 0.95 },
    { key: "framework", value: "Next.js", confidence: 0.9 }
  ],
  reminders: [
    { toolName: "fs", action: "write", content: "User prefers 2-space indentation" }
  ]
}
```

## Tool Lifecycle System

Tools are first-class citizens with full lifecycle hooks, not just simple function wrappers:

### Lifecycle Hooks

```typescript
interface ToolLifecycle<TInput, TOutput> {
  beforeExecute?: (input: TInput) => Promise<TInput> | TInput;
  validate?: (input: TInput) => Promise<ValidationResult> | ValidationResult;
  afterExecute?: (input: TInput, output: TOutput) => Promise<TOutput> | TOutput;
  onError?: (error: Error, input: TInput) => Promise<TOutput | 'throw'> | TOutput | 'throw';
  cleanup?: (input: TInput, didSucceed: boolean) => Promise<void> | void;
}
```

- **beforeExecute** - Transform or enrich input before execution
- **validate** - Reject invalid inputs with structured errors before any work
- **afterExecute** - Transform output, add metadata, trigger side effects
- **onError** - Recover from errors or provide fallback responses
- **cleanup** - Always runs, even on failure (resource cleanup, logging)

### Structured Error Types

```typescript
enum ToolErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PATH_NOT_IN_WORKSPACE = 'PATH_NOT_IN_WORKSPACE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TIMEOUT = 'TIMEOUT',
  INVALID_INPUT = 'INVALID_INPUT',
  COMMAND_BLOCKED = 'COMMAND_BLOCKED',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',
  OPERATION_FAILED = 'OPERATION_FAILED',
}
```

Every tool error includes type, message, and details - enabling agents to understand failures and adapt.

### Instrumentation

All tools are automatically instrumented with timing:

```typescript
// Every tool call logs:
[fs] Starting { args: { action: 'read', path: '/src/index.ts' } }
[fs] Completed { durationMs: 12.34, durationSec: 0.012 }
```

## Device Control System

Cross-platform device automation with a unified driver interface:

### Unified Driver Interface

```typescript
interface DeviceDriver {
  execute(action: DeviceAction): Promise<ActionResult>
  getCapabilities(): Promise<DeviceCapabilities>
  getUITree?(): Promise<UIElement>  // Android only
}
```

### Platform Drivers

| Platform | Driver | Technology | Features |
|----------|--------|------------|----------|
| Desktop | `DesktopDriver` | nut.js | Mouse, keyboard, screenshots. Supports macOS, Linux (Wayland), Windows |
| Android | `AndroidDriver` | Native Accessibility Service | Tap, swipe, type, UI tree extraction, screenshots |
| Web | `WebDriver` | Playwright | Browser automation, element interaction |

### Android Accessibility Service

The Android driver uses a native Kotlin accessibility service (`AgentAccessibilityService`) that:

- **Runs as a system service** - Full access to all UI elements
- **Extracts UI trees** - Complete hierarchy with bounds, text, clickability
- **Takes screenshots** - Uses Android R+ screenshot API
- **Performs gestures** - Click, long press, swipe, type via accessibility actions

```kotlin
// UI tree extraction returns:
{
  "id": "com.app:id/button",
  "type": "button",
  "bounds": { "x": 100, "y": 200, "width": 150, "height": 50 },
  "text": "Submit",
  "clickable": true,
  "children": [...]
}
```

### Server Device Registry

The server maintains a registry of connected devices:

```typescript
// Devices connect via WebSocket and register capabilities
POST /devices/:deviceId/action  // Execute action on device
GET  /devices                   // List connected devices
WS   /                          // Device connection + action results
```

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
