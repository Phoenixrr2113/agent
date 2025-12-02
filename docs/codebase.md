# AI Agent Platform - Complete Codebase Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Architecture](#monorepo-architecture)
3. [Package Documentation](#package-documentation)
   - [@agent/shared](#agentshared)
   - [@agent/core](#agentcore)
   - [@agent/server](#agentserver)
   - [@agent/device-use](#agentdevice-use)
   - [@agent/benchmarks](#agentbenchmarks)
   - [@agent/mobile-accessibility](#agentmobile-accessibility)
4. [Applications](#applications)
   - [CLI App](#cli-app)
   - [Mobile App](#mobile-app)
5. [Core Package Deep Dive](#core-package-deep-dive)
6. [Development Workflow](#development-workflow)
7. [Testing](#testing)
8. [Data Flow](#data-flow)

---

## Project Overview

**AI Agent Platform** is a server-side AI agent runtime for Node.js applications built as a modern monorepo. It provides persistent memory, web search capabilities, shell execution, cross-platform device control, and optional codebase understanding through RAG (Retrieval-Augmented Generation).

### Key Features

- **Persistent Memory**: SQLite-based knowledge graph with automatic entity extraction
- **Web Intelligence**: Search (Brave/Tavily) and page parsing (Readability)
- **Shell Execution**: Full bash command access with safety checks
- **Device Control**: Cross-platform automation (macOS, Linux, Windows, iOS, Android) using nut.js
- **Filesystem Tools**: 12 comprehensive file operations (read, write, edit, search, move, copy, etc.)
- **Smart Tool Management**: Deferred loading with semantic search and dynamic activation
- **Sequential Thinking**: Multi-step reasoning with branching and revision support
- **Codebase Tools**: RAG-powered semantic search and grep functionality
- **Session Management**: Multiple concurrent conversations with isolated history
- **HTTP Server**: Built-in Hono server with REST API and SSE streaming
- **Benchmark Support**: Adapters for HAL, tau-bench, SWE-bench, and GAIA evaluations
- **Programmatic API**: Import as a library or run standalone
- **Turborepo Build System**: Lightning-fast builds with caching

### Technology Stack

- **Language**: TypeScript (ES2022)
- **Runtime**: Node.js 20+
- **Build System**: Turborepo + pnpm workspaces
- **AI SDK**: Vercel AI SDK 6.0 (beta)
- **LLM Provider**: OpenRouter (multi-provider access)
- **Embeddings**: Google AI (text-embedding-004)
- **Database**: better-sqlite3
- **HTTP Server**: Hono
- **Code Parsing**: code-chopper (AST-based chunking)
- **Search**: wink-bm25-text-search (BM25 indexing)
- **Web Parsing**: Mozilla Readability + JSDOM
- **Device Control**: nut.js (cross-platform automation)
- **Mobile**: React Native + Expo

---

## Monorepo Architecture

### Structure

```
agent-platform/
├── packages/
│   ├── shared/           # @agent/shared - Shared utilities & types
│   ├── core/             # @agent/core - Agent runtime engine
│   ├── server/           # @agent/server - HTTP API server
│   ├── device-use/       # @agent/device-use - Cross-platform device control
│   ├── benchmarks/       # @agent/benchmarks - Evaluation adapters
│   └── mobile-accessibility/  # @agent/mobile-accessibility - Native mobile module
├── apps/
│   ├── cli/              # @agent/cli - CLI applications
│   └── mobile/           # Mobile app - React Native/Expo app
├── docs/                 # Documentation
├── scripts/              # Build and utility scripts
├── docker/               # Docker configurations
├── pnpm-workspace.yaml   # pnpm workspace configuration
├── turbo.json            # Turborepo configuration
├── package.json          # Root package configuration
└── tsconfig.base.json    # Shared TypeScript configuration
```

### Build System

The project uses **Turborepo** for efficient monorepo builds:

- **Caching**: Build outputs are cached locally and can be shared remotely
- **Parallel Execution**: Independent packages build in parallel
- **Dependency Graph**: Turborepo understands package dependencies
- **Incremental Builds**: Only changed packages rebuild

**Key Commands**:
```bash
pnpm build          # Build all packages (with caching)
pnpm test           # Run all tests
pnpm dev            # Development mode with watch
pnpm clean          # Clean all build outputs
```

### Workspace Dependencies

Packages reference each other using `workspace:*` protocol:

```json
{
  "dependencies": {
    "@agent/shared": "workspace:*",
    "@agent/core": "workspace:*"
  }
}
```

---

## Package Documentation

### @agent/shared

**Location**: `packages/shared/`
**Purpose**: Shared utilities and types used across all packages

#### Key Exports

##### `packages/shared/src/utils/logger.ts`

Structured logging system with levels, colors, and metadata.

**Log Levels**:
```typescript
const LOG_LEVELS = {
  debug: 0,  // Verbose debugging
  info: 1,   // General information
  warn: 2,   // Warnings
  error: 3,  // Errors
};
```

**Usage**:
```typescript
import { logger } from '@agent/shared';

logger.info('Starting task', { taskId: '123' });
logger.debug('Tool called', { tool: 'shell', args: { command: 'ls' } });
logger.error('Operation failed', { error: 'Connection timeout' });
```

**Features**:
- ANSI color codes for terminal output
- ISO timestamps
- Structured metadata (JSON-like objects)
- Environment-based log level (`LOG_LEVEL` env var)

##### `packages/shared/src/utils/performance.ts`

Performance tracking utilities for monitoring execution times.

**Key Functions**:
```typescript
export function measureTime<T>(fn: () => T): { result: T; durationMs: number };
export function formatDuration(ms: number): string;
```

**Usage**:
```typescript
import { measureTime, formatDuration } from '@agent/shared';

const { result, durationMs } = measureTime(() => {
  // Expensive operation
  return processData();
});

logger.info(`Processed in ${formatDuration(durationMs)}`);
```

---

### @agent/core

**Location**: `packages/core/`
**Purpose**: Core agent runtime engine with memory, RAG, and tool orchestration

#### Directory Structure

```
packages/core/src/
├── index.ts                    # Main exports
├── runtime/
│   └── agent-runtime.ts        # Session management and task execution
├── application/
│   ├── initialization.ts       # Tool and RAG setup
│   └── orchestrator.ts         # Agent creation and step handling
├── core/
│   ├── agents/                 # Agent configuration
│   │   ├── models.ts           # Model tier management
│   │   ├── roles.ts            # Role-based prompts
│   │   └── factory.ts          # Agent factory
│   ├── memory/                 # Knowledge graph system
│   │   ├── types.ts            # Core types
│   │   ├── storage.ts          # Storage interface
│   │   ├── storage-sqlite.ts   # SQLite implementation
│   │   ├── provider-graphiti.ts # External Graphiti provider
│   │   ├── factory.ts          # Provider factory
│   │   ├── index.ts            # MemoryLite implementation
│   │   ├── extraction.ts       # LLM-based extraction
│   │   └── extractor.ts        # Extraction orchestration
│   ├── rag/                    # RAG system
│   │   ├── index.ts            # Main RAG orchestrator
│   │   ├── chunking.ts         # Code chunking
│   │   ├── context.ts          # Contextual descriptions
│   │   ├── cache.ts            # File-based caching
│   │   ├── bm25.ts             # BM25 text search
│   │   ├── rerank.ts           # Cohere reranking
│   │   └── strategies/         # Chunking strategies
│   │       ├── base.ts         # Base interface
│   │       ├── code-strategy.ts    # AST-based chunking
│   │       ├── document-strategy.ts # Markdown/text chunking
│   │       └── registry.ts     # Strategy registry
│   ├── search/
│   │   └── grep.ts             # Workspace grep
│   └── tool-instrumentation.ts # Tool performance tracking
├── tools/
│   ├── index.ts                # Tool exports
│   ├── shell.ts                # Bash execution
│   ├── web-search.ts           # Brave/Tavily search
│   ├── fetch-page.ts           # Web page fetching
│   ├── memory.ts               # Memory operations
│   ├── workflow.ts             # Planning and validation
│   ├── codebase.ts             # Code search tools
│   ├── agent.ts                # Agent control tools
│   ├── filesystem.ts           # File operations (NEW)
│   ├── registry.ts             # Tool discovery
│   └── tool-wrapper.ts         # Tool activation manager (NEW)
├── infrastructure/
│   └── prompts/
│       └── templates.ts        # System prompts
└── types/
    └── wink-bm25-text-search.d.ts # Type definitions
```

#### Key Components

##### Runtime Layer

**`packages/core/src/runtime/agent-runtime.ts`**

Core runtime managing agent lifecycle, sessions, and memory extraction.

**Key Types**:
```typescript
interface AgentConfig {
  workspaceRoot?: string;
  askUserHandler?: (question: string) => Promise<string>;
}

interface TaskResult {
  text: string;
  messages: ModelMessage[];
  completed: boolean;
  needsInput: boolean;
  pendingQuestion?: string;
  stepsUsed: number;
  toolsUsed: string[];
}

interface AgentSession {
  send(message: string): Promise<TaskResult>;
  runTask(input: TaskInput): Promise<TaskResult>;
  getHistory(): ModelMessage[];
  clearHistory(): void;
}

interface AgentRuntime {
  createSession(): AgentSession;
  shutdown(): Promise<void>;
}
```

**Session Lifecycle**:
1. User submits task
2. Agent generates response with tool calls
3. Tools execute and return results
4. Agent processes results and continues reasoning
5. Memory extraction occurs when agent finishes (no tool calls)
6. Codebase re-indexes if files were modified

##### Application Layer

**`packages/core/src/application/initialization.ts`**

Initializes all agent components including tools, RAG, and registry.

**Process**:
1. Create tool registry
2. Index codebase (if workspace provided)
3. Assemble core tools
4. Register tools with metadata
5. Generate embeddings for semantic search
6. Set up dynamic tool loading

**`packages/core/src/application/orchestrator.ts`**

Creates and configures agent with step handlers and context management.

**Key Functions**:
- `createPrepareStep()`: Trims conversation history to fit context window (max 50 messages)
- `cleanAIText()`: Removes XML thinking tags from responses
- `createStepFinishHandler()`: Displays step-by-step reasoning
- `createAgent()`: Creates main agent with all configuration

##### Agent System

**`packages/core/src/core/agents/models.ts`**

Model configuration and tier management.

**Model Tiers**:
```typescript
const MODEL_TIERS = {
  fast: 'deepseek/deepseek-chat-v3-0324:free',
  standard: 'google/gemini-2.0-flash-001',
  reasoning: 'deepseek/deepseek-r1:free',
  powerful: 'anthropic/claude-sonnet-4',
};
```

**`packages/core/src/core/agents/roles.ts`**

Role-based system prompts for specialized agents.

**Available Roles**:
- `generic`: Default role with balanced capabilities
- `researcher`: Information gathering specialist
- `coder`: Code modification specialist
- `analyst`: Data analysis specialist

**`packages/core/src/core/agents/factory.ts`**

Factory for creating agents with specific roles and configuration.

```typescript
export function createAgentWithRole(
  role: AgentRole,
  tools: Record<string, any>,
  options?: {
    modelType?: 'fast' | 'standard' | 'reasoning' | 'powerful';
    stopWhen?: any;
    prepareStep?: any;
    onStepFinish?: any;
  }
): ToolLoopAgent;
```

##### Memory System

The memory system implements a persistent knowledge graph with automatic extraction.

**Core Types** (`packages/core/src/core/memory/types.ts`):

```typescript
interface Entity {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

interface Relation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  weight: number;
  attributes: Record<string, unknown>;
  createdAt: Date;
}

interface Fact {
  id: string;
  content: string;
  embedding: number[];
  entityIds: string[];
  relationIds: string[];
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
  source: string;
  confidence: number;
}

interface Episode {
  id: string;
  groupId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  factIds: string[];
  entityIds: string[];
  timestamp: Date;
}
```

**Storage Implementations**:

1. **SQLite** (`packages/core/src/core/memory/storage-sqlite.ts`): Default, file-based storage
2. **Graphiti** (`packages/core/src/core/memory/provider-graphiti.ts`): External graph memory service

**Extraction Pipeline** (`packages/core/src/core/memory/extraction.ts`):

1. Extract entities, relations, and facts from text using LLM
2. Resolve entity conflicts (same entity mentioned multiple ways)
3. Detect contradictions with existing facts
4. Generate embeddings for semantic search
5. Store in knowledge graph

##### RAG System

The RAG system enables semantic code search through a multi-stage pipeline.

**`packages/core/src/core/rag/index.ts`** - Main orchestrator

**Pipeline**:
1. **Scan**: Find all files in workspace
2. **Chunk**: Split files by strategy (AST for code, semantic for docs)
3. **Contextualize**: Generate searchable descriptions with LLM
4. **Embed**: Create vector embeddings
5. **Index**: Build vector + BM25 indexes
6. **Search**: Hybrid retrieval with reranking

**Chunking Strategies**:

- **CodeChunkingStrategy** (`packages/core/src/core/rag/strategies/code-strategy.ts`): AST-based chunking using tree-sitter parsers for .ts, .js, .py, .rs, .go, .java, .c, .cpp files
- **DocumentChunkingStrategy** (`packages/core/src/core/rag/strategies/document-strategy.ts`): Heading/paragraph-based chunking for .md, .txt files

**Search Flow**:
```
Query → Embedding → Vector Search → BM25 Search → RRF Fusion → Rerank → Results
```

##### Tool System

**`packages/core/src/tools/shell.ts`** - Shell Tool

Executes bash commands with safety checks.

**Safety Features**:
- Blocks dangerous patterns (`rm -rf /`, `dd`, `mkfs`, fork bombs)
- Timeout limits (30s default)
- Output size limits (1MB default)

**`packages/core/src/tools/filesystem.ts`** - Filesystem Tools (NEW)

Comprehensive file operations with path sandboxing.

**12 Tools**:
1. `read_file`: Read file contents
2. `write_file`: Create or overwrite file
3. `edit_file`: Targeted edits using old/new text matching
4. `delete_file`: Delete file
5. `move_file`: Move or rename file
6. `copy_file`: Copy file
7. `create_directory`: Create directory (recursive)
8. `list_directory`: List directory contents
9. `search_files`: Search files by glob pattern
10. `get_file_info`: Get file metadata (size, dates, permissions)
11. `read_multiple_files`: Read multiple files in one call
12. `insert_code_block`: Insert code at specific line number

**Security Features**:
- Path sandboxing (only allowed directories)
- Null byte protection
- Path traversal prevention
- Symlink validation

**`packages/core/src/tools/web-search.ts`** - Web Search Tool

Search via Brave and Tavily APIs.

**Engines**:
- **Brave**: General web search
- **Tavily**: Research-focused with AI summaries

**`packages/core/src/tools/fetch-page.ts`** - Fetch Page Tool

Fetches and extracts clean content from web pages using Readability + JSDOM.

**`packages/core/src/tools/memory.ts`** - Memory Tools

Wrappers for memory system operations:
- `memory_search`: Semantic search
- `memory_get_episodes`: Recent conversation memories
- `memory_get_fact`: Fact details
- `memory_get_entity`: Entity details
- `memory_get_related`: Graph traversal

**`packages/core/src/tools/workflow.ts`** - Workflow Tools

Planning and validation:
- `plan`: Multi-step plan management
- `validate`: TypeScript checking and test execution

**`packages/core/src/tools/codebase.ts`** - Codebase Tools

Code search capabilities:
- `search_codebase`: Semantic code search using RAG
- `grep_codebase`: Regex pattern matching

**`packages/core/src/tools/agent.ts`** - Agent Control Tools

Agent interaction:
- `task_complete`: Signal task completion
- `ask_user`: Request user input

**`packages/core/src/tools/registry.ts`** - Tool Registry

Dynamic tool discovery and activation system.

**Features**:
- Keyword and semantic search
- Metadata management
- Embedding-based discovery
- Lazy tool loading

**`packages/core/src/core/tool-instrumentation.ts`** - Tool Instrumentation (NEW)

Performance tracking for tools.

**Features**:
- Automatic timing measurement
- Structured logging
- Error tracking
- Duration metadata injection

```typescript
export function instrumentTool<TArgs, TResult>(
  toolName: string,
  execute: (args: TArgs) => Promise<TResult> | TResult
): (args: TArgs) => Promise<TResult>;

export function instrumentTools(tools: Record<string, any>): Record<string, any>;
```

---

### @agent/server

**Location**: `packages/server/`
**Purpose**: HTTP server with REST API for agent interactions

#### Structure

```
packages/server/src/
├── index.ts              # Server implementation and exports
└── types/                # Type definitions
```

#### Key Features

- Built on Hono (lightweight web framework)
- Session-based conversation management
- REST API and SSE streaming support
- CORS configuration

#### API Endpoints

##### Health Check
```
GET /health
Response: { status: 'ok' }
```

##### Session Management
```
POST /sessions
Response: { sessionId: string }

DELETE /sessions/:sessionId
Response: { success: boolean }
```

##### Chat
```
POST /sessions/:sessionId/chat
Body: { message: string }
Response: {
  text: string,
  completed: boolean,
  needsInput: boolean,
  pendingQuestion?: string,
  stepsUsed: number,
  toolsUsed: string[]
}
```

##### Streaming Chat
```
GET /sessions/:sessionId/chat/stream?message=...
Response: Server-Sent Events (SSE)
Events:
  - start: { sessionId }
  - complete: { ...TaskResult }
```

##### History
```
GET /sessions/:sessionId/history
Response: { messages: ModelMessage[] }

POST /sessions/:sessionId/clear
Response: { success: boolean }
```

##### Convenience Endpoint
```
POST /chat
Body: { message: string, sessionId?: string }
Response: { sessionId: string, ...TaskResult }
```
Auto-creates session if not provided.

---

### @agent/device-use

**Location**: `packages/device-use/`
**Purpose**: Cross-platform device control for desktop and mobile (macOS, Linux, Windows, iOS, Android)

#### Structure

```
packages/device-use/src/
├── index.ts              # Main exports
├── types.ts              # Type definitions
├── tools.ts              # Tool implementations
├── driver.ts             # Base driver interface
├── drivers/
│   ├── desktop.ts        # Desktop driver (nut.js)
│   └── android.ts        # Android driver (ADB/Appium)
└── utils/
    └── safety.ts         # Safety validation
```

#### Key Technologies

- **nut.js**: Cross-platform desktop automation (100x faster than CLI tools)
- **ADB**: Android device control
- **Appium**: Mobile automation (iOS/Android)

#### Supported Actions

**Computer Actions**:
```typescript
type ComputerAction =
  | 'key'           // Keyboard input
  | 'type'          // Type text
  | 'mouse_move'    // Move mouse to coordinates
  | 'left_click'    // Click left mouse button
  | 'right_click'   // Click right mouse button
  | 'middle_click'  // Click middle mouse button
  | 'double_click'  // Double click
  | 'screenshot'    // Capture screen
  | 'cursor_position'; // Get cursor position
```

**Platform Support**:
- **Desktop**: macOS, Linux (X11 + Wayland), Windows
- **Mobile**: iOS (via Appium), Android (via ADB + Appium)

#### Features

- High-performance native automation
- Screenshot capture with base64 encoding
- Safety validation for destructive actions
- Coordinate normalization across screen sizes
- Text editor integration

---

### @agent/benchmarks

**Location**: `packages/benchmarks/`
**Purpose**: Benchmark adapters for testing the agent against evaluation harnesses

#### Structure

```
packages/benchmarks/src/
├── index.ts              # Main exports
├── cli.ts                # CLI interface
├── types.ts              # Benchmark types
└── adapters/
    ├── hal.ts            # HAL adapter
    ├── tau-bench.ts      # tau-bench adapter
    ├── swe-bench.ts      # SWE-bench adapter
    └── gaia.ts           # GAIA adapter
```

#### Supported Benchmarks

1. **HAL** - General agent evaluation
2. **tau-bench** - Task-oriented dialogues (retail, airline domains)
3. **SWE-bench** - Software engineering tasks
4. **GAIA** - General AI assistant evaluation

#### CLI Usage

```bash
# Run tau-bench retail domain
pnpm benchmark:tau-retail

# Run tau-bench airline domain
pnpm benchmark:tau-airline

# Run GAIA benchmark
pnpm benchmark:gaia

# Run SWE-bench
agent-benchmark --benchmark swe-bench
```

#### Key Features

- Standardized task execution interface
- Result scoring and validation
- Session management and reset
- Graceful shutdown handling

---

### @agent/mobile-accessibility

**Location**: `packages/mobile-accessibility/`
**Purpose**: Native mobile accessibility module for React Native (Expo)

#### Structure

```
packages/mobile-accessibility/
├── android/              # Android native module
│   └── src/
├── plugin/
│   └── src/
│       └── withMobileAccessibility.ts
└── package.json
```

#### Features

- Native accessibility API access
- Screen reader support
- UI element inspection
- Touch event simulation
- Gesture recognition

#### Platform Support

- **Android**: AccessibilityService API
- **iOS**: (Coming in Phase 3)

---

## Applications

### CLI App

**Location**: `apps/cli/`
**Purpose**: Command-line interfaces for server and interactive chat

#### Structure

```
apps/cli/src/
├── cli.ts                # Server launcher
├── chat.ts               # Interactive chat CLI
└── types/                # Type definitions
```

#### Commands

**Server Launcher** (`cli.ts`):
```bash
# Start HTTP server
pnpm --filter @agent/cli run start

# Environment variables
PORT=3000 WORKSPACE_ROOT=/path/to/project pnpm start
```

**Interactive Chat** (`chat.ts`):
```bash
# Start chat interface
pnpm --filter @agent/cli run chat

# With workspace
WORKSPACE_ROOT=/path/to/project pnpm chat
```

#### Features

- REPL-style chat interface
- Tool usage display
- Task completion status
- Readline with history
- Graceful shutdown (Ctrl+C)

---

### Mobile App

**Location**: `apps/mobile/`
**Purpose**: React Native mobile application with Expo

#### Structure

```
apps/mobile/
├── app/                  # App screens (Expo Router)
│   ├── (tabs)/           # Tab navigation
│   │   ├── index.tsx     # Home screen
│   │   └── explore.tsx   # Explore screen
│   ├── _layout.tsx       # Root layout
│   └── modal.tsx         # Modal screen
├── components/           # Reusable components
│   ├── ui/               # UI components
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   └── ...
├── hooks/                # Custom hooks
├── constants/            # Constants and theme
├── assets/               # Images, fonts, etc.
└── app.json              # Expo configuration
```

#### Technologies

- **React Native**: Cross-platform mobile framework
- **Expo**: Development and build tooling
- **Expo Router**: File-based navigation
- **TypeScript**: Type safety

#### Features

- Tab-based navigation
- Themed components (light/dark mode)
- Native device control integration
- Accessibility support
- Haptic feedback

---

## Core Package Deep Dive

This section provides detailed documentation for the most complex parts of the core package.

### Memory System Architecture

The memory system is a knowledge graph with automatic extraction from conversations.

#### Data Model

```
┌─────────────┐
│   Entity    │
│  (People,   │
│  Projects,  │
│  Concepts)  │
└──────┬──────┘
       │
       │ Relation
       │ (WORKS_ON,
       │  CREATED,
       │  PART_OF)
       │
       ▼
┌──────────────┐       ┌─────────────┐
│     Fact     │───────│   Episode   │
│  (Atomic     │       │ (Conversation
│  statements) │       │  Turn)
└──────────────┘       └─────────────┘
```

#### Extraction Flow

```
Conversation Completes (no tool calls)
  ↓
Extract Dialogue Text
  ↓
LLM Extraction
  ├─→ Entities
  ├─→ Relations
  └─→ Facts
  ↓
For each Entity:
  ├─→ Check if exists
  ├─→ Resolve conflicts
  ├─→ Generate embedding
  └─→ Store or update
  ↓
For each Relation:
  ├─→ Link entities
  └─→ Store with weight
  ↓
For each Fact:
  ├─→ Check contradictions
  ├─→ Invalidate superseded
  ├─→ Generate embedding
  └─→ Store with validity dates
  ↓
Create Episode
```

#### Conflict Resolution

When a new entity is extracted, the system checks if an entity with that name already exists. If it does, an LLM determines if they refer to the same thing:

```typescript
// Example
// Existing: { name: 'Randy', type: 'person', attributes: { role: 'developer' } }
// New: { name: 'Randy Wilson', type: 'person', attributes: { prefers: 'TypeScript' } }
// Result: Merge into { name: 'Randy Wilson', attributes: { role: 'developer', prefers: 'TypeScript' } }
```

#### Contradiction Detection

When a new fact is added, the system checks for contradictions with existing facts:

```typescript
// Example
// Existing: "Randy prefers JavaScript"
// New: "Randy prefers TypeScript"
// Result: Invalidate old fact, insert new fact
```

### RAG System Architecture

The RAG system provides semantic code search through a hybrid retrieval pipeline.

#### Indexing Pipeline

```
Workspace Files
  ↓
Strategy Selection
  ├─→ Code Files (.ts, .js, .py, etc.) → CodeChunkingStrategy (AST)
  └─→ Docs (.md, .txt) → DocumentChunkingStrategy (Semantic)
  ↓
Chunking
  ├─→ Functions/Classes (for code)
  └─→ Headings/Paragraphs (for docs)
  ↓
Context Generation (LLM)
  ├─→ Generate searchable description
  └─→ Extract key concepts
  ↓
Embedding Generation
  ├─→ Google text-embedding-004
  └─→ 768-dimensional vectors
  ↓
Indexing
  ├─→ Vector Index (cosine similarity)
  └─→ BM25 Index (keyword matching)
```

#### Search Pipeline

```
User Query
  ↓
Generate Query Embedding
  ↓
Parallel Search
  ├─→ Vector Search (top 100)
  └─→ BM25 Search (top 100)
  ↓
Reciprocal Rank Fusion (RRF)
  ├─→ Merge results
  └─→ Score = 1 / (k + rank)
  ↓
Reranking (Cohere)
  ├─→ Top 100 candidates
  └─→ Return top 20
  ↓
Results to Agent
```

#### Caching Strategy

The RAG system uses file-based caching to avoid re-processing unchanged files:

```typescript
// Cache key = hash(file content + file path + chunking strategy)
// Cached data = { chunks, embeddings, contextual descriptions }
// Cache location = .rag-cache/ directory
```

---

## Development Workflow

### Project Setup

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

### Development Commands

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @agent/core build

# Clean all build outputs
pnpm clean

# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @agent/core test

# Watch mode for tests
pnpm --filter @agent/core test:watch

# Type checking
pnpm exec tsc --noEmit

# Linting
pnpm lint
pnpm lint:fix
```

### Adding a New Package

1. Create package directory in `packages/`
2. Initialize `package.json`:
```json
{
  "name": "@agent/new-package",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "vitest run"
  }
}
```
3. Create `tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```
4. Add to `turbo.json` if needed
5. Reference from other packages using `workspace:*`

### Adding a New Tool

1. Create tool file in `packages/core/src/tools/`
2. Define tool using `tool()` from Vercel AI SDK:
```typescript
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
3. Export from `packages/core/src/tools/index.ts`
4. Register in `packages/core/src/application/initialization.ts`
5. Add tests in `packages/core/src/tools/*.test.ts`

---

## Testing

### Test Structure

```
packages/core/tests/
├── fixtures/
│   ├── sample-code.ts
│   └── sample-utils.js
├── helpers/
│   ├── test-mcp-server.ts
│   ├── test-model.ts
│   └── test-utils.ts
└── [test files organized by module]
```

### Test Files by Module

**RAG System**:
- `packages/core/src/core/rag/bm25.test.ts` - BM25 indexing and search
- `packages/core/src/core/rag/chunking.test.ts` - Code chunking
- `packages/core/src/core/rag/strategies/document-strategy.test.ts` - Document chunking
- `packages/core/src/core/rag/strategies/registry.test.ts` - Strategy registry

**Tools**:
- `packages/core/src/tools/registry.test.ts` - Tool registry
- `packages/core/src/tools/filesystem.test.ts` - Filesystem tools
- `packages/core/src/tools/tool-wrapper.test.ts` - Tool activation manager

**Memory**:
- `packages/core/src/core/memory/index.test.ts` - Memory system
- `packages/core/src/core/memory/extractor.test.ts` - Memory extractor

**Application**:
- `packages/core/src/application/initialization.test.ts` - Initialization

**Benchmarks**:
- `packages/benchmarks/src/adapters/hal.test.ts` - HAL adapter
- `packages/benchmarks/src/adapters/tau-bench.test.ts` - tau-bench adapter
- `packages/benchmarks/src/adapters/swe-bench.test.ts` - SWE-bench adapter
- `packages/benchmarks/src/adapters/gaia.test.ts` - GAIA adapter

**Device Use**:
- `packages/device-use/tests/` - Device control tests

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @agent/core test

# Watch mode
pnpm --filter @agent/core test:watch

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

## Data Flow

### User Message Flow

```
User Input
  ↓
HTTP Server OR CLI OR Mobile App
  ↓
AgentSession.send()
  ↓
Agent.generate() [Vercel AI SDK]
  ├→ Reasoning Steps
  ├→ Tool Calls
  │   ├→ shell (execute commands)
  │   ├→ filesystem (file operations)
  │   ├→ web_search (fetch web data)
  │   ├→ memory_search (query knowledge graph)
  │   ├→ search_codebase (RAG retrieval)
  │   ├→ device_control (automation)
  │   └→ ... (other tools)
  └→ Response Generation
  ↓
Task Result
  ├→ Update conversation history
  ├→ Re-index codebase (if files modified)
  └→ Extract memories (if no tool calls)
```

### Memory Extraction Flow

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

### RAG Search Flow

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

### Filesystem Tools

**Path Sandboxing**:
- Only allowed directories are accessible
- Path traversal prevention
- Symlink validation
- Null byte protection

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

**"Device control not working"**
- Check platform support
- Verify nut.js installation
- Check accessibility permissions (macOS)

---

## Design Patterns

### Factory Pattern

Used extensively for creating complex objects:
- `createAgentRuntime()` - Runtime factory
- `createAgent()` - Agent factory
- `createAgentWithRole()` - Role-based agents
- `createMemoryProvider()` - Provider factory
- `createCodebaseRAG()` - RAG factory
- `createToolRegistry()` - Registry factory
- `createDeviceTools()` - Device tools factory

### Strategy Pattern

Used for pluggable behavior:
- **Chunking Strategies**: `CodeChunkingStrategy`, `DocumentChunkingStrategy`
- **Memory Providers**: `MemoryLite`, `GraphitiProvider`
- **Agent Roles**: `generic`, `researcher`, `coder`, `analyst`

### Observer Pattern

Used for step tracking and logging:
- `onStepFinish` callback in agent orchestrator
- Progress callbacks in RAG indexing

### Repository Pattern

Used in memory system:
- `StorageAdapter` interface with `entities`, `relations`, `facts`, `episodes` repositories
- Multiple implementations (in-memory, SQLite)

### Facade Pattern

Used for simplified APIs:
- `AgentRuntime` facade for complex initialization
- `CodebaseRAG` facade for multi-step retrieval
- Tool wrappers simplify complex operations

---

**End of Documentation**

This documentation covers the complete monorepo architecture. For additional details on specific topics, see:
- `ARCHITECTURE.md` - Evolution roadmap
- `CONTRIBUTING.md` - Contribution guidelines
- `TESTING.md` - Testing strategies
- Individual package READMEs
