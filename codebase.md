# AI Agent Runtime - Complete Codebase Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Module Documentation](#module-documentation)
   - [Entry Points](#entry-points)
   - [Runtime Layer](#runtime-layer)
   - [Application Layer](#application-layer)
   - [Core Layer](#core-layer)
   - [Tools Layer](#tools-layer)
   - [Infrastructure Layer](#infrastructure-layer)
5. [Data Flow](#data-flow)
6. [Testing](#testing)

---

## Project Overview

**ai-agent-runtime** is a server-side AI agent framework for Node.js that provides persistent memory, web search capabilities, shell execution, and optional codebase understanding through RAG (Retrieval-Augmented Generation). The project is designed to be used either as a library embedded in other applications or as a standalone HTTP server.

### Key Features

- **Persistent Memory**: SQLite-based knowledge graph with automatic entity extraction
- **Web Intelligence**: Search (Brave/Tavily) and page parsing (Readability)
- **Shell Execution**: Full bash command access
- **Codebase Tools**: RAG-powered semantic search and grep functionality
- **Session Management**: Multiple concurrent conversations with isolated history
- **HTTP Server**: Built-in Hono server with REST API
- **Programmatic API**: Import as a library or run standalone

### Technology Stack

- **Language**: TypeScript (ES2022)
- **Runtime**: Node.js 20+
- **AI SDK**: Vercel AI SDK 6.0 (beta)
- **LLM Provider**: OpenRouter (multi-provider access)
- **Embeddings**: Google AI (text-embedding-004)
- **Database**: better-sqlite3
- **HTTP Server**: Hono
- **Code Parsing**: code-chopper (AST-based chunking)
- **Search**: wink-bm25-text-search (BM25 indexing)
- **Web Parsing**: Mozilla Readability + JSDOM

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │  Initialization  │           │   Orchestrator   │        │
│  │  - Tool Setup    │           │  - Agent Factory │        │
│  │  - RAG Index     │           │  - Step Handling │        │
│  └──────────────────┘           └──────────────────┘        │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
┌───────────────▼─────────────────────────▼───────────────────┐
│                      Runtime Layer                           │
│  ┌──────────────────────────────────────────────────┐       │
│  │              Agent Runtime                        │       │
│  │  - Session Management                            │       │
│  │  - Conversation History                          │       │
│  │  - Memory Extraction Orchestration               │       │
│  └──────────────────────────────────────────────────┘       │
└───────────────┬──────────────────────┬──────────────────────┘
                │                      │
    ┌───────────▼──────────┐   ┌──────▼────────────┐
    │     Core Layer       │   │   Tools Layer     │
    │  - Memory            │   │  - Shell          │
    │  - RAG               │   │  - Web Search     │
    │  - Agents            │   │  - Fetch Page     │
    │  - Logger            │   │  - Memory Tools   │
    │  - Search            │   │  - Codebase       │
    └──────────────────────┘   │  - Workflow       │
                               │  - Agent Control  │
                               └───────────────────┘
```

### Layered Architecture

#### 1. Entry Points Layer
- **cli.ts**: CLI entry point for running standalone server
- **server.ts**: HTTP server with REST API endpoints
- **chat.ts**: Interactive CLI for testing
- **index.ts**: Library exports for programmatic use

#### 2. Runtime Layer
- **agent-runtime.ts**: Core runtime managing sessions, history, and task execution

#### 3. Application Layer
- **initialization.ts**: Sets up tools, RAG indexing, and agent configuration
- **orchestrator.ts**: Creates agents, manages step callbacks, and context trimming

#### 4. Core Layer
- **Memory System**: Entity extraction, knowledge graph, and persistence
- **RAG System**: Codebase indexing, chunking strategies, and semantic search
- **Agent System**: Model configuration, role-based prompts, and agent factory
- **Logger**: Structured logging with levels and colors
- **Search**: Grep-based workspace search

#### 5. Tools Layer
- **shell**: Execute bash commands with safety checks
- **web-search**: Brave and Tavily search integration
- **fetch-page**: Web page fetching and parsing
- **memory**: Knowledge graph operations
- **codebase**: Semantic search and grep for code
- **workflow**: Plan management and validation
- **agent**: Task completion and user interaction
- **registry**: Tool discovery and dynamic loading

#### 6. Infrastructure Layer
- **prompts/templates.ts**: System prompts for agent behavior

---

## Core Concepts

### 1. Agent Sessions

Each conversation is isolated in a session. Sessions maintain their own:
- Message history
- Context window (auto-trimmed to 50 messages)
- Memory extraction state

Sessions are stateless between invocations - all state lives in memory or persistent storage.

### 2. Memory System

The memory system implements a knowledge graph with automatic extraction:

**Components**:
- **Entities**: Named things (people, projects, concepts)
- **Relations**: Connections between entities
- **Facts**: Atomic pieces of information with temporal validity
- **Episodes**: Conversation turns linked to extracted knowledge

**Storage Options**:
- **SQLite (default)**: Local file-based storage at `./memory.db`
- **Graphiti**: Optional external graph memory service

**Extraction Process**:
1. Agent completes a response with no tool calls
2. Memory extractor analyzes conversation
3. LLM extracts entities, relations, and facts
4. Embeddings generated for semantic search
5. Stored in SQLite with conflict resolution

### 3. RAG (Retrieval-Augmented Generation)

The RAG system enables semantic code search:

**Pipeline**:
1. **Chunking**: Files split by strategy (AST for code, semantic for docs)
2. **Context Generation**: LLM generates searchable descriptions
3. **Embedding**: Google text-embedding-004 creates vectors
4. **Indexing**: Combined vector + BM25 index
5. **Search**: Hybrid retrieval with reranking (Cohere)

**Chunking Strategies**:
- **CodeChunkingStrategy**: AST-based (functions, classes, methods)
- **DocumentChunkingStrategy**: Heading/paragraph-based

**Search Flow**:
```
Query → Embedding → Vector Search → BM25 Search → RRF Fusion → Rerank → Results
```

### 4. Tool System

Tools are organized with a registry that supports:
- **Dynamic loading**: Tools can be activated on-demand
- **Semantic search**: Find tools by natural language description
- **Metadata**: Tags, descriptions, examples for discoverability

**Tool Categories**:
- **Core Tools**: Always available (shell, web_search, memory, etc.)
- **Workspace Tools**: Available when workspace provided (search_codebase, grep_codebase)
- **Workflow Tools**: Planning and validation
- **Control Tools**: ask_user, task_complete

### 5. Model Configuration

The system uses tiered models via OpenRouter:

- **fast**: deepseek/deepseek-chat-v3-0324:free (quick tasks)
- **standard**: google/gemini-2.0-flash-001 (default)
- **reasoning**: deepseek/deepseek-r1:free (complex reasoning)
- **powerful**: anthropic/claude-sonnet-4 (high-quality responses)

---

## Module Documentation

## Entry Points

### src/index.ts

**Purpose**: Main library entry point that validates environment and exports public API.

**Key Functions**:

#### Environment Validation
```typescript
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;
```
Checks if running in Node.js environment. Throws error if:
- Running in browser (needs native modules)
- Not in Node.js environment

**Exports**:
- `createAgentRuntime()`: Factory for agent runtime
- `createServer()`, `startServer()`: HTTP server functions
- `ToolRegistry` and related tool functions
- TypeScript types for public API

**Usage Example**:
```typescript
import { createAgentRuntime } from 'ai-agent-runtime';
const runtime = await createAgentRuntime();
```

---

### src/cli.ts

**Purpose**: CLI entry point for running standalone server.

**Behavior**:
1. Loads environment variables from `.env`
2. Reads `PORT` and `WORKSPACE_ROOT` from environment
3. Calls `startServer()` with configuration
4. Exits with error code 1 on failure

**Environment Variables**:
- `PORT`: HTTP server port (default: 3000)
- `WORKSPACE_ROOT`: Path to workspace for codebase tools

**Shebang**: `#!/usr/bin/env node` - makes file executable

---

### src/chat.ts

**Purpose**: Interactive CLI for testing agent in terminal.

**Features**:
- REPL-style interface for chatting with agent
- Readline-based user input with history
- Shows tool usage and task completion status
- Graceful shutdown on SIGINT (Ctrl+C)

**Key Functions**:

#### Main Loop
Continuously prompts user for input, sends to agent, displays response.

**User Input Handler**:
```typescript
askUserHandler: async (question: string) => {
  logger.info('🤔 Agent asks', { question });
  const answer = await rl.question('👤 Your response: ');
  return answer;
}
```
Allows agent to ask clarification questions.

**Usage**:
```bash
pnpm chat
# or with workspace
WORKSPACE_ROOT=/path/to/project pnpm chat
```

---

### src/server.ts

**Purpose**: HTTP server with REST API for agent interactions.

**Architecture**:
- Built on Hono (lightweight web framework)
- Session-based conversation management
- Supports both regular and streaming responses

**Key Functions**:

#### `createServer(config?: ServerConfig)`
Creates and configures HTTP server without starting it.

**Parameters**:
- `config.port`: Server port (default: 3000)
- `config.workspaceRoot`: Path for codebase tools
- `config.corsOrigin`: CORS origins (default: '*')

**Returns**: `{ app, runtime, port }`

#### `startServer(config?: ServerConfig)`
Creates server and starts listening.

**Endpoints**:

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

**Session Storage**:
```typescript
const sessions = new Map<string, AgentSession>();
```
In-memory map of session ID to session instance.

**Shutdown Handling**:
Listens for SIGINT/SIGTERM, clears sessions, closes runtime, stops server.

---

## Runtime Layer

### src/runtime/agent-runtime.ts

**Purpose**: Core runtime managing agent lifecycle, sessions, and memory extraction.

**Key Types**:

#### `AgentConfig`
```typescript
interface AgentConfig {
  workspaceRoot?: string;  // Path to workspace for codebase tools
  askUserHandler?: (question: string) => Promise<string>;
}
```

#### `TaskInput`
```typescript
interface TaskInput {
  prompt?: string;         // Direct user message
  messages?: ModelMessage[]; // Or full message array
}
```

#### `TaskResult`
```typescript
interface TaskResult {
  text: string;           // Agent's response text
  messages: ModelMessage[]; // Full conversation history
  completed: boolean;     // true if task_complete called
  needsInput: boolean;    // true if ask_user called
  pendingQuestion?: string; // Question waiting for user
  stepsUsed: number;      // Reasoning steps taken
  toolsUsed: string[];    // Tools invoked
}
```

#### `AgentSession`
```typescript
interface AgentSession {
  send(message: string): Promise<TaskResult>;
  runTask(input: TaskInput): Promise<TaskResult>;
  getHistory(): ModelMessage[];
  clearHistory(): void;
}
```

#### `AgentRuntime`
```typescript
interface AgentRuntime {
  createSession(): AgentSession;
  shutdown(): Promise<void>;
}
```

**Key Functions**:

#### `createAgentRuntime(config?: AgentConfig)`

Creates the agent runtime with all necessary initialization.

**Process**:
1. Calls `initializeAgent()` to set up tools and RAG
2. Initializes memory provider and extractor
3. Configures `ask_user` tool handler
4. Creates agent with orchestrator
5. Returns runtime factory

**Custom ask_user Handling**:
```typescript
if (config.askUserHandler) {
  tools.ask_user = {
    ...tools.ask_user,
    execute: async (args: { question: string }) => {
      return askUserHandler(args.question);
    },
  };
} else {
  // Auto-approve by returning 'yes'
  tools.ask_user = {
    ...tools.ask_user,
    execute: async (args: { question: string }) => {
      logger.info('🤖 ask_user auto-approved', { question: args.question });
      return 'yes';
    },
  };
}
```

#### Session Factory (`createSession()`)

Creates isolated session with:
- Private conversation history
- Task execution logic
- Memory extraction on completion

**Session Lifecycle**:

1. **Task Submission** (`runTask()`)
   - Appends user message to history
   - Calls agent.generate() with full history
   - Logs timing and step count

2. **Response Processing**
   - Extracts tool calls from steps
   - Updates conversation history
   - Re-indexes codebase if files modified

3. **Completion Detection**
   - Checks for `task_complete` tool call
   - Extracts unique tools used
   - Triggers memory extraction if no tool calls

4. **Input Detection**
   - Checks for `ask_user` tool call
   - Extracts pending question

**Memory Extraction Logic**:
```typescript
const hasNoToolCalls = toolsUsed.length === 0;
if (hasNoToolCalls) {
  await memoryExtractor.extractFromConversation(conversationHistory);
}
```
Only extracts when agent has finished reasoning (no tools called).

**Codebase Reindexing**:
```typescript
const modifiedFiles = result.steps.some((step: any) =>
  step.toolCalls?.some((tc: any) =>
    ['write_file', 'edit_file', 'create_directory'].includes(tc.toolName)
  )
);
if (modifiedFiles) {
  await codebaseRAG.indexCodebase();
}
```
Re-indexes if agent modified files through shell.

#### `shutdown()`

Gracefully shuts down runtime:
1. Waits for pending memory extractions
2. Closes memory provider connections

---

## Application Layer

### src/application/initialization.ts

**Purpose**: Initializes all agent components including tools, RAG, and registry.

**Key Types**:

#### `InitializationConfig`
```typescript
interface InitializationConfig {
  workspaceRoot?: string;
  enableReadline?: boolean;
  registry?: ToolRegistry;
  enableSemanticSearch?: boolean;
}
```

#### `InitializationResult`
```typescript
interface InitializationResult {
  tools: Record<string, any>;
  codebaseRAG: any;
  readline: readline.Interface | null;
  registry: ToolRegistry;
}
```

**Key Functions**:

#### `initializeAgent(config?)`

Main initialization function that sets up the agent environment.

**Process**:

1. **Readline Setup** (if enabled)
   ```typescript
   let rl: readline.Interface | null = null;
   if (enableReadline) {
     rl = readline.createInterface({ input, output });
   }
   ```

2. **Registry Creation**
   ```typescript
   const registry = providedRegistry ?? createToolRegistry();
   ```

3. **Codebase RAG Indexing** (if workspace provided)
   ```typescript
   if (workspaceRoot) {
     codebaseRAG = createCodebaseRAG(workspaceRoot);
     await codebaseRAG.indexCodebase();
   }
   ```
   - Creates RAG instance
   - Scans and chunks files
   - Generates embeddings
   - Builds BM25 index

4. **Tool Assembly**
   ```typescript
   const coreTools = {
     shell: shellTool,
     web_search: webSearchTool,
     fetch_page: fetchPageTool,
     ...memoryTools,
     plan: planTool,
     ...workspaceTools,
     ...agentTools,
   };
   ```

5. **Tool Registration**
   ```typescript
   registry.registerMany(coreTools, { deferLoading: false });
   ```

6. **Semantic Search Setup** (if enabled)
   ```typescript
   if (enableSemanticSearch) {
     await registry.generateEmbeddings();
   }
   ```
   Generates embeddings for all tool descriptions for semantic tool discovery.

7. **Dynamic Tool Loading Setup**
   ```typescript
   const searchTool = createToolSearchTool(registry);
   const activateTool = createActivateToolTool(registry, activeTools);
   const tools = {
     ...coreTools,
     search_tools: searchTool,
     activate_tool: activateTool,
   };
   ```

**Tool Categories**:
- **Core Tools**: shell, web_search, fetch_page, memory_*, plan
- **Workspace Tools**: search_codebase, grep_codebase, validate
- **Agent Tools**: ask_user, task_complete
- **Discovery Tools**: search_tools, activate_tool

**Returns**: Complete initialization result with all tools and RAG.

#### `cleanup(rl)`

Cleanup function for graceful shutdown:
```typescript
export async function cleanup(rl: readline.Interface | null) {
  logger.info('🧹 Cleaning up...');
  if (rl) {
    rl.close();
  }
  await closeMemory();
}
```

---

### src/application/orchestrator.ts

**Purpose**: Creates and configures agent with step handlers and context management.

**Key Functions**:

#### `createPrepareStep()`

Creates function that trims conversation history to fit context window.

**Context Management**:
```typescript
const MAX_CONTEXT_MESSAGES = 50;

if (messages.length > MAX_CONTEXT_MESSAGES) {
  logger.info('🔄 Trimming context', { from: messages.length, to: MAX_CONTEXT_MESSAGES });
  return {
    messages: [
      messages[0],  // Keep system message
      ...messages.slice(-(MAX_CONTEXT_MESSAGES - 1)),  // Keep last N-1 messages
    ],
  };
}
```

**Why?**
- Prevents token limit errors
- Maintains system prompt
- Keeps recent context

#### `cleanAIText(text)`

Removes XML tags from agent responses:
```typescript
function cleanAIText(text: string): string {
  const xmlTagPattern = /<\/?[a-zA-Z_][a-zA-Z0-9_-]*(?:\s+[^>]*)?\/?>/g;
  const cleaned = text.replace(xmlTagPattern, '').trim();
  return cleaned;
}
```

Some models output thinking tags like `<thinking>...</thinking>`. This strips them for cleaner UX.

#### `createStepFinishHandler()`

Creates callback for displaying step-by-step agent reasoning.

**Output Format**:
```
═══════════════════════════════════════════
📈 STEP 1
═══════════════════════════════════════════

💭 AI THINKING:
────────────────────────────────────────
[Agent's reasoning text]

🔧 TOOL CALL: shell
────────────────────────────────────────
📥 INPUT:
{
  "command": "ls -la"
}

📤 OUTPUT:
[Command output]
```

**Features**:
- Tracks step count
- Displays agent reasoning
- Shows tool inputs/outputs with truncation
- Cleans XML tags from thinking

#### `createAgent(tools, maxSteps?)`

Creates the main agent with all configuration.

**Parameters**:
- `tools`: Complete tool set
- `maxSteps`: Maximum reasoning steps (default: 50)

**Agent Configuration**:
```typescript
return createAgentWithRole('generic', tools, {
  modelType: 'standard',
  stopWhen: stepCountIs(maxSteps),
  prepareStep: createPrepareStep(),
  onStepFinish: createStepFinishHandler(),
});
```

**Stop Conditions**:
- Max steps reached
- `task_complete` called
- Model stops naturally

---

## Core Layer

### Core: Agents

#### src/core/agents/models.ts

**Purpose**: Model configuration and tier management.

**Model Tiers**:
```typescript
const MODEL_TIERS = {
  fast: process.env.MODEL_FAST || 'deepseek/deepseek-chat-v3-0324:free',
  standard: process.env.MODEL_STANDARD || 'google/gemini-2.0-flash-001',
  reasoning: process.env.MODEL_REASONING || 'deepseek/deepseek-r1:free',
  powerful: process.env.MODEL_POWERFUL || 'anthropic/claude-sonnet-4',
};
```

**Model Selection**:
Each tier returns an OpenRouter chat model:
```typescript
export const models = {
  fast: () => {
    const modelName = MODEL_TIERS.fast;
    logger.info('🔌 Using OpenRouter model', { tier: 'fast', model: modelName });
    return openrouter.chat(modelName);
  },
  // ... other tiers
};
```

**Environment Override**:
Users can override defaults:
```bash
MODEL_STANDARD=anthropic/claude-3.5-sonnet
```

---

#### src/core/agents/roles.ts

**Purpose**: Role-based system prompts for specialized agents.

**Roles**:

##### `generic`
Default role with balanced capabilities. Imported from templates.

##### `researcher`
Specialized for information gathering:
```typescript
researcher: `You are a research specialist. Your job is to gather information thoroughly.

ALWAYS use tools:
- web_search for finding information online
- fetch_page for reading web content and documentation
- search_codebase for semantic code search
- grep_codebase for finding specific patterns
- memory_add to store key findings
- plan to organize multi-step research

Never just describe what you would research - actually do the research using tools.`
```

**Key Directive**: "Never just describe" - enforces action over narration.

##### `coder`
Specialized for code modification:
```typescript
coder: `You are a senior software engineer. Your job is to write and modify code.

ALWAYS use tools:
- search_codebase to understand existing patterns
- grep_codebase to find specific code
- shell to read files (cat), write files, run git commands, execute tests
- validate after code changes to check for errors

Never describe code changes - actually make them.`
```

##### `analyst`
Specialized for data analysis:
```typescript
analyst: `You are a data and business analyst. Your job is to analyze information and provide insights.

ALWAYS use tools:
- web_search and fetch_page to gather external data
- search_codebase to understand data structures
- shell to run analysis scripts or queries
- memory_add to store findings for later reference
- plan to organize multi-step analysis

Never just describe analysis - use tools to perform it.`
```

**Usage**: Different agents can be created for different task types using these roles.

---

#### src/core/agents/factory.ts

**Purpose**: Factory for creating agents with specific roles and configuration.

**Key Function**:

#### `createAgentWithRole(role, tools, options?)`

Creates a ToolLoopAgent with role-specific configuration.

**Parameters**:
```typescript
role: AgentRole  // 'generic' | 'researcher' | 'coder' | 'analyst'
tools: Record<string, any>  // Tool set
options?: {
  modelType?: keyof typeof models;  // 'fast' | 'standard' | 'reasoning' | 'powerful'
  stopWhen?: any;  // Stop condition
  prepareStep?: any;  // Context prep function
  onStepFinish?: any;  // Step callback
}
```

**Implementation**:
```typescript
export function createAgentWithRole(role, tools, options?) {
  const modelType = options?.modelType || 'standard';

  return new ToolLoopAgent({
    model: models[modelType](),
    instructions: systemPrompts[role],
    tools,
    stopWhen: options?.stopWhen,
    prepareStep: options?.prepareStep,
    onStepFinish: options?.onStepFinish,
  });
}
```

**ToolLoopAgent** (from Vercel AI SDK):
- Implements agentic tool-calling loop
- Handles multi-step reasoning
- Manages tool execution and result integration

---

### Core: Logger

#### src/core/logger.ts

**Purpose**: Structured logging system with levels, colors, and metadata.

**Log Levels**:
```typescript
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,  // Verbose debugging
  info: 1,   // General information
  warn: 2,   // Warnings
  error: 3,  // Errors
};
```

**Color Codes**:
```typescript
const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',  // Cyan
  info: '\x1b[32m',   // Green
  warn: '\x1b[33m',   // Yellow
  error: '\x1b[31m',  // Red
};
```

**Key Types**:

#### `Logger`
```typescript
interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  setLevel(level: LogLevel): void;
}
```

**Key Functions**:

#### `createLogger(options?)`

Creates logger instance with configuration.

**Options**:
```typescript
interface LoggerOptions {
  level?: LogLevel;  // Minimum level to log
  enableColors?: boolean;  // ANSI colors (default: true)
  enableTimestamps?: boolean;  // ISO timestamps (default: true)
}
```

**Environment Override**:
```typescript
function getEnvLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return 'info';
}
```

**Message Format**:
```
[2025-11-28T10:30:45.123Z] INFO  Agent initialized {"workspaceRoot": "/path/to/project"}
```

**Usage**:
```typescript
import { logger } from './core/logger.js';

logger.info('Starting task', { taskId: '123' });
logger.debug('Tool called', { tool: 'shell', args: { command: 'ls' } });
logger.error('Operation failed', { error: 'Connection timeout' });
```

**Singleton Export**:
```typescript
export const logger = createLogger();
```
Single shared logger instance for entire application.

---

### Core: Memory System

The memory system is one of the most complex parts of the codebase. It implements a persistent knowledge graph with automatic entity extraction.

#### src/core/memory/types.ts

**Purpose**: Type definitions for memory system.

**Core Types**:

##### `Entity`
Represents a named thing in the knowledge graph.

```typescript
interface Entity {
  id: string;  // UUID
  name: string;  // Canonical name
  type: string;  // 'person', 'project', 'concept', etc.
  attributes: Record<string, unknown>;  // Flexible metadata
  embedding?: number[];  // For semantic search
  createdAt: Date;
  updatedAt: Date;
}
```

**Example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Randy Wilson",
  "type": "person",
  "attributes": {
    "role": "developer",
    "prefers": "TypeScript"
  },
  "embedding": [0.23, -0.41, ...],
  "createdAt": "2025-11-28T10:00:00Z",
  "updatedAt": "2025-11-28T10:00:00Z"
}
```

##### `Relation`
Represents a connection between entities.

```typescript
interface Relation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;  // 'WORKS_ON', 'CREATED_BY', etc.
  weight: number;  // Confidence/strength (0-1)
  attributes: Record<string, unknown>;
  createdAt: Date;
}
```

**Example**:
```json
{
  "id": "...",
  "fromEntityId": "...",
  "toEntityId": "...",
  "type": "WORKS_ON",
  "weight": 0.95,
  "attributes": { "since": "2024-01-01" },
  "createdAt": "2025-11-28T10:00:00Z"
}
```

##### `Fact`
Atomic piece of information with temporal validity.

```typescript
interface Fact {
  id: string;
  content: string;  // The fact text
  embedding: number[];  // For search
  entityIds: string[];  // Related entities
  relationIds: string[];  // Related relations
  validFrom: Date;  // When fact became true
  validTo: Date | null;  // When fact became false (null = still valid)
  createdAt: Date;
  source: string;  // Where fact came from
  confidence: number;  // How certain (0-1)
}
```

**Example**:
```json
{
  "id": "...",
  "content": "Randy Wilson prefers TypeScript for backend development",
  "embedding": [0.12, -0.34, ...],
  "entityIds": ["..."],  // Randy Wilson entity
  "relationIds": [],
  "validFrom": "2025-11-28T10:00:00Z",
  "validTo": null,
  "createdAt": "2025-11-28T10:00:00Z",
  "source": "conversation_extraction",
  "confidence": 0.9
}
```

##### `Episode`
A conversation turn with linked knowledge.

```typescript
interface Episode {
  id: string;
  groupId: string;  // Session/conversation ID
  content: string;  // Message content
  role: 'user' | 'assistant' | 'system';
  factIds: string[];  // Facts extracted from this turn
  entityIds: string[];  // Entities mentioned
  timestamp: Date;
}
```

##### `SearchResult`
Result of memory search operation.

```typescript
interface SearchResult {
  facts: Fact[];
  entities: Entity[];
  relations: Relation[];
  score: number;  // Relevance score
}
```

##### `MemoryProvider`
Interface for memory backends.

```typescript
interface MemoryProvider {
  add(input: MemoryAddInput): Promise<{ factIds: string[]; entityIds: string[] }>;
  search(input: MemorySearchInput): Promise<SearchResult>;
  getEpisodes(groupId: string, limit?: number): Promise<Episode[]>;
  getFact(factId: string): Promise<Fact | null>;
  getEntity(entityId: string): Promise<Entity | null>;
  getRelatedEntities(entityId: string, depth?: number): Promise<Entity[]>;
  invalidateFact(factId: string): Promise<void>;
  close(): Promise<void>;
}
```

Two implementations:
- **MemoryLite**: SQLite-based (default)
- **GraphitiProvider**: External service

---

#### src/core/memory/storage.ts

**Purpose**: In-memory storage adapter and interface definition.

**Key Interface**:

##### `StorageAdapter`
Low-level storage interface for memory backends.

```typescript
interface StorageAdapter {
  entities: {
    create(entity: Entity): Promise<void>;
    update(id: string, updates: Partial<Entity>): Promise<void>;
    get(id: string): Promise<Entity | null>;
    findByName(name: string): Promise<Entity | null>;
    findByType(type: string): Promise<Entity[]>;
    search(embedding: number[], limit: number): Promise<Array<{ entity: Entity; score: number }>>;
    all(): Promise<Entity[]>;
  };

  relations: {
    create(relation: Relation): Promise<void>;
    get(id: string): Promise<Relation | null>;
    findByEntity(entityId: string): Promise<Relation[]>;
    findBetween(fromId: string, toId: string): Promise<Relation[]>;
    all(): Promise<Relation[]>;
  };

  facts: {
    create(fact: Fact): Promise<void>;
    update(id: string, updates: Partial<Fact>): Promise<void>;
    get(id: string): Promise<Fact | null>;
    findByEntity(entityId: string): Promise<Fact[]>;
    findValid(asOf?: Date): Promise<Fact[]>;
    search(embedding: number[], limit: number, includeExpired?: boolean): Promise<Array<{ fact: Fact; score: number }>>;
    invalidate(id: string, validTo: Date): Promise<void>;
  };

  episodes: {
    create(episode: Episode): Promise<void>;
    get(id: string): Promise<Episode | null>;
    findByGroup(groupId: string, limit?: number): Promise<Episode[]>;
  };

  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

**Key Functions**:

##### `cosineSimilarity(a, b)`
Computes cosine similarity between two embedding vectors.

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

Formula: `similarity = (A · B) / (||A|| × ||B||)`

Higher score = more similar (range: -1 to 1, typically 0 to 1 for embeddings).

##### `createInMemoryStorage()`

Creates in-memory storage using JavaScript Maps.

**Implementation**:
- Uses `Map<string, T>` for each entity type
- Vector search via brute-force cosine similarity
- No persistence (lost on restart)
- Useful for testing

**When to Use**:
- Unit tests
- Ephemeral sessions
- Development

---

#### src/core/memory/storage-sqlite.ts

**Purpose**: SQLite-based persistent storage adapter.

**Database Schema**:

```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  attributes TEXT NOT NULL,  -- JSON
  embedding TEXT,  -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_entities_type ON entities(type);

CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  from_entity_id TEXT NOT NULL,
  to_entity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  weight REAL NOT NULL,
  attributes TEXT NOT NULL,  -- JSON
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_entity_id) REFERENCES entities(id),
  FOREIGN KEY (to_entity_id) REFERENCES entities(id)
);
CREATE INDEX idx_relations_from ON relations(from_entity_id);
CREATE INDEX idx_relations_to ON relations(to_entity_id);

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,  -- JSON array
  entity_ids TEXT NOT NULL,  -- JSON array
  relation_ids TEXT NOT NULL,  -- JSON array
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL
);
CREATE INDEX idx_facts_valid ON facts(valid_from, valid_to);

CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  content TEXT NOT NULL,
  role TEXT NOT NULL,
  fact_ids TEXT NOT NULL,  -- JSON array
  entity_ids TEXT NOT NULL,  -- JSON array
  timestamp TEXT NOT NULL
);
CREATE INDEX idx_episodes_group ON episodes(group_id, timestamp);
```

**Key Features**:

1. **WAL Mode**: Write-Ahead Logging for better concurrency
   ```typescript
   db.pragma('journal_mode = WAL');
   ```

2. **JSON Storage**: Complex types stored as JSON strings
   ```typescript
   JSON.stringify(entity.attributes)
   ```

3. **Type Parsing**: Converts DB rows back to TypeScript types
   ```typescript
   const parseEntity = (row: any): Entity => ({
     id: row.id,
     name: row.name,
     type: row.type,
     attributes: JSON.parse(row.attributes),
     embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
     createdAt: new Date(row.created_at),
     updatedAt: new Date(row.updated_at),
   });
   ```

4. **Vector Search**: Brute-force but acceptable for small-medium datasets
   ```typescript
   async search(embedding, limit): Promise<EntityWithScore[]> {
     const all: Entity[] = db.prepare('SELECT * FROM entities WHERE embedding IS NOT NULL').all().map(parseEntity);
     return all
       .filter((e: Entity): e is Entity & { embedding: number[] } => e.embedding !== undefined)
       .map((e): EntityWithScore => ({ entity: e, score: cosineSimilarity(embedding, e.embedding) }))
       .sort((a: EntityWithScore, b: EntityWithScore) => b.score - a.score)
       .slice(0, limit);
   }
   ```

5. **Transactions**: ACID guarantees for complex operations
   ```typescript
   async transaction<T>(fn: () => Promise<T>) {
     db.exec('BEGIN');
     try {
       const result = await fn();
       db.exec('COMMIT');
       return result;
     } catch (e) {
       db.exec('ROLLBACK');
       throw e;
     }
   }
   ```

**Performance Considerations**:
- Fast for < 10k entities
- Vector search is O(n) but embeddings are cached
- Indexes on name, type, relations speed up lookups
- WAL mode allows concurrent reads during writes

---

#### src/core/memory/provider-graphiti.ts

**Purpose**: External Graphiti service provider for production deployments.

**Graphiti** is a graph memory service with Neo4j backend, providing:
- Scalable graph storage
- Advanced graph traversal
- Distributed deployment
- Better performance for large graphs

**Key Functions**:

##### `createGraphitiProvider(graphitiUrl)`

Creates provider that communicates with Graphiti HTTP API.

**API Endpoints Used**:

1. **Add Memory**
   ```
   POST /messages
   Body: {
     group_id: string,
     messages: [{
       uuid: string,
       content: string,
       role: string,
       timestamp: string,
       source_description: string
     }]
   }
   ```

2. **Search**
   ```
   POST /search
   Body: {
     query: string,
     group_ids?: string[],
     max_facts: number
   }
   ```

3. **Get Episodes**
   ```
   GET /episodes/:groupId?last_n=10
   ```

4. **Get Entity**
   ```
   GET /entity/:entityId
   ```

5. **Get Related Entities**
   ```
   GET /entity/:entityId/related?depth=1
   ```

6. **Invalidate Fact**
   ```
   POST /entity-edge/:factId/invalidate
   Body: { invalid_at: string }
   ```

**Usage**:
```bash
# Start Graphiti service
docker compose -f docker/graphiti-compose.yml up -d

# Set environment variable
export GRAPHITI_URL=http://localhost:8000
```

The system auto-detects and uses Graphiti if available.

---

#### src/core/memory/factory.ts

**Purpose**: Factory for creating memory providers with auto-detection.

**Key Functions**:

##### `createMemoryProvider(config)`

Creates memory provider based on config.

```typescript
export function createMemoryProvider(config: MemoryConfig): MemoryProvider {
  if (config.provider === 'graphiti') {
    const url = config.graphitiUrl || process.env.GRAPHITI_URL || 'http://localhost:8000';
    return createGraphitiProvider(url);
  }

  return createMemoryLite({
    embeddingModel: config.embeddingModel,
    extractionModel: config.extractionModel,
    storagePath: config.storagePath,
  });
}
```

##### `detectAvailableProvider()`

Auto-detects which provider is available.

```typescript
export async function detectAvailableProvider(): Promise<'graphiti' | 'lite'> {
  const graphitiUrl = process.env.GRAPHITI_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${graphitiUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      return 'graphiti';
    }
  } catch {
    // Graphiti not available
  }

  return 'lite';
}
```

Health check with 2s timeout. Falls back to SQLite if Graphiti unavailable.

##### `createAutoMemoryProvider(config)`

Auto-detects and creates appropriate provider.

```typescript
export async function createAutoMemoryProvider(
  config: Omit<MemoryConfig, 'provider'>
): Promise<MemoryProvider> {
  const provider = await detectAvailableProvider();
  console.log(`Memory provider: ${provider}`);

  return createMemoryProvider({
    ...config,
    provider,
  });
}
```

This is what the application uses for automatic provider selection.

---

#### src/core/memory/index.ts

**Purpose**: Main memory implementation (MemoryLite) with SQLite backend.

**Key Functions**:

##### `createMemoryLite(config)`

Creates full-featured memory system with extraction and embeddings.

**Configuration**:
```typescript
interface MemoryConfig {
  embeddingModel?: string;  // Default: 'text-embedding-004'
  extractionModel?: string;  // Default: gemini-2.0-flash
  storagePath?: string;  // Default: in-memory
}
```

**Internal Functions**:

###### `getEmbedding(text: string)`
Generates embedding vector for text using Google AI.

```typescript
async function getEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel as any,
    value: text
  });
  return embedding;
}
```

###### `getOrCreateEntity(extracted)`
Finds existing entity or creates new one with conflict resolution.

```typescript
async function getOrCreateEntity(
  extracted: { name: string; type: string; attributes: Record<string, unknown> }
): Promise<Entity> {
  const existing = await storage.entities.findByName(extracted.name);

  if (existing) {
    const resolution = await resolveEntityConflicts(extracted, existing, extractionModel);
    if (resolution.shouldMerge && resolution.mergedAttributes) {
      await storage.entities.update(existing.id, { attributes: resolution.mergedAttributes });
      return { ...existing, attributes: resolution.mergedAttributes };
    }
    return existing;
  }

  const embedding = await getEmbedding(`${extracted.name} (${extracted.type}): ${JSON.stringify(extracted.attributes)}`);
  const entity: Entity = {
    id: randomUUID(),
    name: extracted.name,
    type: extracted.type,
    attributes: extracted.attributes,
    embedding,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await storage.entities.create(entity);
  return entity;
}
```

**Conflict Resolution**:
- Checks if entity name already exists
- Uses LLM to determine if same entity
- Merges attributes if confirmed same
- Creates new entity if different

**Provider Implementation**:

##### `add(input: MemoryAddInput)`

Main function for adding content to memory.

**Process**:

1. **Extract Entities, Relations, Facts**
   ```typescript
   const existingEntities = (await storage.entities.all()).map(e => e.name);
   const extracted = await extractFromText(input.content, extractionModel, existingEntities);
   ```
   Uses LLM to extract structured knowledge from text.

2. **Create/Update Entities**
   ```typescript
   const entityMap = new Map<string, Entity>();
   for (const e of extracted.entities) {
     const entity = await getOrCreateEntity(e);
     entityMap.set(e.name, entity);
   }
   ```

3. **Create Relations**
   ```typescript
   for (const r of extracted.relations) {
     const fromEntity = entityMap.get(r.fromEntity);
     const toEntity = entityMap.get(r.toEntity);
     if (fromEntity && toEntity) {
       const relation = {
         id: randomUUID(),
         fromEntityId: fromEntity.id,
         toEntityId: toEntity.id,
         type: r.type,
         weight: r.weight || 0.8,
         attributes: {},
         createdAt: new Date(),
       };
       await storage.relations.create(relation);
     }
   }
   ```

4. **Detect Contradictions**
   ```typescript
   const existingFacts = await storage.facts.findValid();
   const contradictions = await detectContradictions(
     f.content,
     existingFacts.map(ef => ef.content),
     extractionModel
   );

   for (const supersededContent of contradictions.supersedes) {
     const superseded = existingFacts.find(ef => ef.content === supersededContent);
     if (superseded) {
       await storage.facts.invalidate(superseded.id, new Date());
     }
   }
   ```
   Invalidates old facts that are superseded by new information.

5. **Create Facts**
   ```typescript
   const embedding = await getEmbedding(f.content);
   const fact: Fact = {
     id: randomUUID(),
     content: f.content,
     embedding,
     entityIds: relatedEntityIds,
     relationIds: [],
     validFrom: new Date(),
     validTo: null,
     createdAt: new Date(),
     source: input.source || 'user_input',
     confidence: f.confidence,
   };
   await storage.facts.create(fact);
   ```

6. **Create Episode**
   ```typescript
   const episode: Episode = {
     id: randomUUID(),
     groupId: input.groupId || 'default',
     content: input.content,
     role: input.role || 'user',
     factIds,
     entityIds: Array.from(entityMap.values()).map(e => e.id),
     timestamp: new Date(),
   };
   await storage.episodes.create(episode);
   ```

##### `search(input: MemorySearchInput)`

Semantic search over memory.

**Process**:

1. **Generate Query Embedding**
   ```typescript
   const queryEmbedding = await getEmbedding(input.query);
   ```

2. **Vector Search Facts**
   ```typescript
   const factResults = await storage.facts.search(
     queryEmbedding,
     input.maxResults || 10,
     input.includeExpired
   );
   ```

3. **Gather Related Entities/Relations**
   ```typescript
   const entityIds = new Set<string>();
   const relationIds = new Set<string>();
   for (const { fact } of factResults) {
     fact.entityIds.forEach(id => entityIds.add(id));
     fact.relationIds.forEach(id => relationIds.add(id));
   }

   const entities = await Promise.all(
     Array.from(entityIds).map(id => storage.entities.get(id))
   ).then(results => results.filter((e): e is Entity => e !== null));
   ```

4. **Return Complete Result**
   ```typescript
   return {
     facts: factResults.map(r => r.fact),
     entities,
     relations,
     score: factResults[0]?.score || 0,
   };
   ```

##### `getRelatedEntities(entityId, depth)`

Graph traversal to find related entities.

**Implementation**:
```typescript
async getRelatedEntities(entityId: string, depth = 1) {
  const visited = new Set<string>();
  const result: Entity[] = [];

  async function traverse(id: string, currentDepth: number) {
    if (currentDepth > depth || visited.has(id)) return;
    visited.add(id);

    const relations = await storage.relations.findByEntity(id);
    for (const rel of relations) {
      const otherId = rel.fromEntityId === id ? rel.toEntityId : rel.fromEntityId;
      if (!visited.has(otherId)) {
        const entity = await storage.entities.get(otherId);
        if (entity) {
          result.push(entity);
          await traverse(otherId, currentDepth + 1);
        }
      }
    }
  }

  await traverse(entityId, 0);
  return result;
}
```

**Depth Example**:
- Depth 1: Direct neighbors
- Depth 2: Neighbors of neighbors
- Depth 3: Three hops away

---

#### src/core/memory/extraction.ts

**Purpose**: LLM-based extraction of entities, relations, and facts from text.

**Key Functions**:

##### `extractFromText(text, model, existingEntities?)`

Extracts structured knowledge from natural language text.

**Extraction Schema**:
```typescript
const ExtractionSchema = z.object({
  entities: z.array(z.object({
    name: z.string().describe('The canonical name of the entity'),
    type: z.string().describe('Entity type: person, organization, project, concept, location, event, etc.'),
    attributes: z.record(z.unknown()).describe('Key attributes of the entity'),
  })),
  relations: z.array(z.object({
    fromEntity: z.string().describe('Name of the source entity'),
    toEntity: z.string().describe('Name of the target entity'),
    type: z.string().describe('Relationship type in SCREAMING_SNAKE_CASE (e.g., WORKS_ON, CREATED_BY, PART_OF)'),
    weight: z.number().min(0).max(1).optional().describe('Confidence/strength of the relationship'),
  })),
  facts: z.array(z.object({
    content: z.string().describe('A single, atomic fact extracted from the text'),
    entityNames: z.array(z.string()).describe('Names of entities involved in this fact'),
    confidence: z.number().min(0).max(1).describe('Confidence score for this fact'),
  })),
});
```

**Extraction Prompt**:
```
You are an entity and relationship extraction system. Given the input text, extract:

1. ENTITIES: Named things (people, projects, concepts, organizations, etc.)
   - Use canonical names (normalize "Randy", "randy", "Randy Wilson" to "Randy Wilson")
   - Identify the type accurately
   - Extract relevant attributes mentioned

2. RELATIONS: Connections between entities
   - Use active voice relationship types (WORKS_ON, not WORKED_ON_BY)
   - Common types: WORKS_ON, CREATED, OWNS, PART_OF, RELATED_TO, KNOWS, USES, DEPENDS_ON
   - Assign weight based on how explicitly stated the relationship is

3. FACTS: Atomic pieces of information
   - Each fact should be self-contained and verifiable
   - Link facts to the entities they involve
   - Assign confidence based on how definitive the statement is

Be thorough but precise. Only extract what is explicitly stated or strongly implied.
```

**Normalization with Existing Entities**:
```typescript
const contextPrompt = existingEntities?.length
  ? `\n\nKnown entities (prefer these names if referring to the same thing): ${existingEntities.join(', ')}`
  : '';
```

Helps LLM use consistent entity names across extractions.

**Usage**:
```typescript
const extracted = await extractFromText(
  "Randy prefers TypeScript for backend work and created the auth-service project.",
  model,
  ['Randy Wilson']
);
// Result:
// {
//   entities: [
//     { name: 'Randy Wilson', type: 'person', attributes: { prefers: 'TypeScript' } },
//     { name: 'auth-service', type: 'project', attributes: { language: 'TypeScript' } }
//   ],
//   relations: [
//     { fromEntity: 'Randy Wilson', toEntity: 'auth-service', type: 'CREATED', weight: 1.0 }
//   ],
//   facts: [
//     { content: 'Randy Wilson prefers TypeScript for backend development', entityNames: ['Randy Wilson'], confidence: 0.95 },
//     { content: 'Randy Wilson created the auth-service project', entityNames: ['Randy Wilson', 'auth-service'], confidence: 1.0 }
//   ]
// }
```

##### `resolveEntityConflicts(newEntity, existingEntity, model)`

Determines if two entity mentions refer to the same real-world entity.

**Schema**:
```typescript
schema: z.object({
  shouldMerge: z.boolean().describe('Whether these entities refer to the same thing'),
  mergedAttributes: z.record(z.unknown()).optional().describe('Combined attributes if merging'),
  reasoning: z.string().describe('Brief explanation'),
})
```

**Prompt**:
```
Determine if these two entities refer to the same thing and should be merged:

Entity 1: ${JSON.stringify(newEntity)}
Entity 2: ${JSON.stringify(existingEntity)}

If they are the same entity, merge their attributes (prefer newer/more specific values).
```

**Example**:
```typescript
// Existing: { name: 'Randy', type: 'person', attributes: { role: 'developer' } }
// New: { name: 'Randy Wilson', type: 'person', attributes: { prefers: 'TypeScript' } }
// Result: { shouldMerge: true, mergedAttributes: { role: 'developer', prefers: 'TypeScript' } }
```

##### `detectContradictions(newFact, existingFacts, model)`

Identifies which existing facts are contradicted or superseded by a new fact.

**Schema**:
```typescript
schema: z.object({
  contradicts: z.array(z.number()).describe('Indices of facts that directly contradict the new fact'),
  supersedes: z.array(z.number()).describe('Indices of facts that the new fact updates/replaces'),
})
```

**Prompt**:
```
Analyze if the new fact contradicts or supersedes any existing facts.

New fact: "${newFact}"

Existing facts:
${existingFacts.map((f, i) => `${i}: "${f}"`).join('\n')}

- contradicts: Facts that cannot both be true (logical contradiction)
- supersedes: Facts that the new fact updates (same topic, newer information)
```

**Example**:
```typescript
// Existing: ["Randy prefers JavaScript", "Randy lives in Seattle"]
// New: "Randy prefers TypeScript"
// Result: { contradicts: [], supersedes: [0] }
// Action: Invalidate fact at index 0, insert new fact
```

---

#### src/core/memory/extractor.ts

**Purpose**: Orchestrates memory extraction from conversations.

**Key Types**:

##### `MemoryExtractorConfig`
```typescript
interface MemoryExtractorConfig {
  memoryProvider: MemoryProvider;
  groupId?: string;  // Default: 'default'
}
```

##### `MemoryExtractor`
```typescript
interface MemoryExtractor {
  extractFromConversation(messages: ModelMessage[]): Promise<void>;
  waitForPending(): Promise<void>;
}
```

**Key Functions**:

##### `extractDialogueText(messages)`

Converts message history to plain dialogue format.

```typescript
function extractDialogueText(messages: ModelMessage[]): string {
  const dialogueParts: string[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      if (typeof message.content === 'string') {
        dialogueParts.push(`User: ${message.content}`);
      } else if (Array.isArray(message.content)) {
        const textParts = message.content
          .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
          .map(part => part.text);
        if (textParts.length > 0) {
          dialogueParts.push(`User: ${textParts.join(' ')}`);
        }
      }
    } else if (message.role === 'assistant') {
      // Similar handling for assistant messages
    }
  }

  return dialogueParts.join('\n\n');
}
```

**Output Format**:
```
User: I'm working on a TypeScript project

Assistant: I need to implement authentication
```

Extracts only text content, ignoring tool calls and system messages.

##### `createMemoryExtractor(config)`

Creates memory extractor instance.

**Implementation**:
```typescript
export function createMemoryExtractor(config: MemoryExtractorConfig): MemoryExtractor {
  const { memoryProvider, groupId = 'default' } = config;
  const pendingExtractions: Promise<void>[] = [];

  async function doExtraction(dialogueText: string): Promise<void> {
    if (\!dialogueText.trim()) {
      return;
    }

    try {
      const result = await memoryProvider.add({
        content: dialogueText,
        role: 'user',
        groupId,
        source: 'conversation_extraction',
      });

      logger.info('Memory extraction complete', {
        factIds: result.factIds.length,
        entityIds: result.entityIds.length,
      });
    } catch (error) {
      logger.error('Memory extraction failed', { error: String(error) });
    }
  }

  return {
    async extractFromConversation(messages: ModelMessage[]): Promise<void> {
      const dialogueText = extractDialogueText(messages);
      const extraction = doExtraction(dialogueText);
      pendingExtractions.push(extraction);

      try {
        await extraction;
      } finally {
        const index = pendingExtractions.indexOf(extraction);
        if (index > -1) {
          pendingExtractions.splice(index, 1);
        }
      }
    },

    async waitForPending(): Promise<void> {
      if (pendingExtractions.length > 0) {
        await Promise.all(pendingExtractions);
      }
    },
  };
}
```

**Features**:
- Tracks pending extractions for graceful shutdown
- Handles extraction errors gracefully
- Logs extraction results

**Usage in Runtime**:
```typescript
const memoryExtractor = createMemoryExtractor({ memoryProvider });

// After task completes without tool calls
const hasNoToolCalls = toolsUsed.length === 0;
if (hasNoToolCalls) {
  await memoryExtractor.extractFromConversation(conversationHistory);
}

// On shutdown
await memoryExtractor.waitForPending();
```

---

## Core: RAG System

The RAG (Retrieval-Augmented Generation) system enables semantic code search through chunking, embedding, and hybrid retrieval.

Continuing in next message due to length...
