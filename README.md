# Generic Agent Template

A **minimal, UI-less** AI agent template designed to be embedded in other applications. Built with TypeScript, provides a pluggable runtime with native tools for shell execution, web search, and graph-based memory.

## 🌟 What Makes This Agent Special

### Minimal Native Tool Architecture
Instead of 50+ MCP servers, this agent uses **6 native tools**:
- **shell** - Bash execution (git, filesystem, grep, etc.)
- **web_search** - Brave + Tavily APIs
- **fetch_page** - Parse web content with readability
- **memory** - Knowledge graph with LLM-based entity extraction (SQLite or Graphiti)
- **ask_user** - Get user input
- **task_complete** - Signal completion

### Core Capabilities
- **RAG-Powered Codebase Understanding**: Semantic search with intelligent chunking
- **Graph-Based Memory**: Automatic entity/relationship extraction via LLM
- **Shell Access**: Full bash execution for git, filesystem, and system operations
- **Web Intelligence**: Search and fetch with Brave, Tavily, and readability parsing
- **Pattern Matching**: Regex-based grep for exact code searches

### Designed for Integration
This is a **library/template** meant to be embedded in your applications:
- REST APIs and web services
- CLI tools
- Background workers
- React Native apps (via API)
- Any Node.js application

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm
- API Keys:
  - OpenRouter ([get one free](https://openrouter.ai/))
  - Google Generative AI ([get one free](https://aistudio.google.com/apikey))
  - Tavily ([get one](https://tavily.com/)) - optional
  - Brave Search ([get one](https://brave.com/search/api/)) - optional

### Installation

```bash
pnpm install
cp .env.example .env
```

Edit `.env`:
```env
OPENROUTER_API_KEY=sk-or-v1-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
BRAVE_API_KEY=BSA...
```

### Test the Agent

```bash
pnpm chat
```

This starts an interactive chat for testing. Memory is stored locally in SQLite by default.

### Optional: Graphiti Memory (Advanced)

For production deployments requiring Neo4j-backed graph memory:

```bash
docker compose -f docker/graphiti-compose.yml up -d
```

The agent auto-detects Graphiti and uses it when available.

## 📚 Architecture

### How It Works

The agent operates in a loop:
1. **Indexes its codebase** using RAG (Google Gemini embeddings)
2. **Receives a task** from the user
3. **Searches its codebase** to understand relevant code
4. **Uses native tools** to execute shell commands, search web, manage memory
5. **Repeats** until task is complete

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Agent Runtime                                 │
│              (src/runtime/agent-runtime.ts)                     │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─► Native Tools (src/tools/)
               │   ├─► shell.ts      (bash execution)
               │   ├─► web-search.ts (Brave + Tavily)
               │   ├─► fetch-page.ts (readability parsing)
               │   ├─► memory.ts     (Graphiti REST API)
               │   ├─► codebase.ts   (RAG + grep)
               │   └─► agent.ts      (ask_user, task_complete)
               │
               ├─► RAG System (src/core/rag/)
               │   └─► Semantic vector search over codebase
               │
               └─► Memory System (src/core/memory/)
                   └─► SQLite (default) or Graphiti (optional)
```

### Native Tools

| Tool | Description |
|------|-------------|
| `shell` | Execute bash commands (git, ls, grep, etc.) |
| `web_search` | Search with Brave and/or Tavily APIs |
| `fetch_page` | Fetch and parse web pages with readability |
| `memory_add` | Add content to knowledge graph |
| `memory_search` | Search memory for facts/relationships |
| `memory_get_episodes` | Get recent memory episodes |
| `memory_get_fact` | Get specific fact by ID |
| `memory_get_entity` | Get entity details |
| `memory_get_related` | Get related entities via graph traversal |
| `search_codebase` | Semantic RAG search |
| `grep_codebase` | Regex pattern matching |
| `plan` | Create/update implementation plans |
| `validate` | TypeScript type checking and tests |
| `ask_user` | Ask user a question |
| `task_complete` | Signal task completion |

### Memory System

The agent includes a knowledge graph memory with:
- **Automatic Entity Extraction**: LLM extracts entities and relationships
- **Temporal Awareness**: Tracks when facts become valid/invalid
- **Semantic Search**: Embedding-based similarity search
- **Graph Traversal**: Find related entities through relationships

**Two backends available:**
- **MemoryLite (default)**: SQLite-based, zero-config, npm-installable
- **Graphiti (optional)**: Neo4j-backed, production-grade, requires Docker

## 🧪 Testing

```bash
pnpm test          # Run all tests
pnpm test:watch    # Watch mode
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | For RAG embeddings + memory |
| `TAVILY_API_KEY` | No | Tavily search API |
| `BRAVE_API_KEY` | No | Brave search API |
| `MEMORY_DB_PATH` | No | SQLite path for MemoryLite (default: ./memory.db) |
| `GRAPHITI_URL` | No | If set and reachable, uses Graphiti instead of MemoryLite |

## 📖 Usage

### Integration in Your Application

```typescript
import { createAgentRuntime } from './src/runtime/agent-runtime.js';

// Initialize once at startup
const runtime = await createAgentRuntime({
  workspaceRoot: '/path/to/workspace',
  askUserHandler: async (question) => {
    // Handle agent questions (e.g., via websocket, queue, etc.)
    return 'User response';
  },
});

// Create a session per conversation
const session = runtime.createSession();

// Send messages
const result = await session.send('Search for TypeScript patterns');

console.log(result.text);        // Agent's response
console.log(result.completed);   // true if task_complete was called
console.log(result.toolsUsed);   // ['shell', 'search_codebase', ...]

// Continue the conversation
const result2 = await session.send('Explain what you found');

// Get conversation history
const history = session.getHistory();

// Cleanup on shutdown
await runtime.shutdown();
```

### Example: Express API

```typescript
import express from 'express';
import { createAgentRuntime } from './src/runtime/agent-runtime.js';

const app = express();
const runtime = await createAgentRuntime();
const sessions = new Map();

app.post('/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  let session = sessions.get(sessionId);
  if (!session) {
    session = runtime.createSession();
    sessions.set(sessionId, session);
  }

  const result = await session.send(message);
  res.json({
    text: result.text,
    completed: result.completed,
    toolsUsed: result.toolsUsed,
  });
});
```

### Testing Locally

```bash
pnpm chat
```

```
👤 You: Remember that my name is Randy and I prefer TypeScript
🤖 Agent: Got it! I've stored that in memory.

👤 You: List files in src/tools
🤖 Agent: [uses shell tool: ls -la src/tools]
```

## 🔧 Development

### Project Structure

```
src/
├── tools/                     # Native tools
│   ├── shell.ts              # Bash execution
│   ├── web-search.ts         # Brave + Tavily search
│   ├── fetch-page.ts         # Web page parsing
│   ├── memory.ts             # Memory tools (auto-selects backend)
│   ├── codebase.ts           # RAG + grep tools
│   ├── agent.ts              # ask_user, task_complete
│   └── workflow.ts           # plan, validate tools
│
├── core/
│   ├── memory/               # Knowledge graph memory
│   │   ├── types.ts          # Core interfaces
│   │   ├── extraction.ts     # LLM entity extraction
│   │   ├── storage.ts        # Storage adapters
│   │   ├── index.ts          # MemoryLite provider
│   │   └── factory.ts        # Auto-detection
│   └── rag/                  # RAG implementation
│
├── application/               # Application orchestration
│   ├── initialization.ts     # Tool setup
│   └── orchestrator.ts       # Agent creation
│
├── runtime/                   # Runtime architecture
│   └── agent-runtime.ts      # Session-based runtime
│
├── chat.ts                    # Interactive testing CLI
└── index.ts                   # Library exports

docker/
└── graphiti-compose.yml      # Optional: Neo4j + Graphiti
```

### Adding Custom Tools

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: 'Does something useful',
  inputSchema: z.object({
    input: z.string(),
  }),
  execute: async ({ input }) => {
    return JSON.stringify({ result: input });
  },
});
```

## ⚠️ Security

This agent can execute shell commands and access the filesystem. Run in a safe environment.

## 📝 License

MIT

## 🙏 Acknowledgments

- [Vercel AI SDK](https://sdk.vercel.ai/)
- [Graphiti by Zep](https://github.com/getzep/graphiti)
- [OpenRouter](https://openrouter.ai/)
- [Tavily](https://tavily.com/)
- [Brave Search](https://brave.com/search/api/)
