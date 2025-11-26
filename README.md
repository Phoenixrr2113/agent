# Generic Agent Template

A **minimal, UI-less** AI agent template designed to be embedded in other applications. Built with TypeScript, provides a pluggable runtime with native tools for shell execution, web search, and graph-based memory.

## 🌟 What Makes This Agent Special

### Minimal Native Tool Architecture
Instead of 50+ MCP servers, this agent uses **6 native tools**:
- **shell** - Bash execution (git, filesystem, grep, etc.)
- **web_search** - Brave + Tavily APIs
- **fetch_page** - Parse web content with readability
- **memory** - Graphiti knowledge graph (Neo4j-backed)
- **ask_user** - Get user input
- **task_complete** - Signal completion

### Core Capabilities
- **RAG-Powered Codebase Understanding**: Semantic search with intelligent chunking
- **Graph-Based Memory**: Graphiti extracts entities/relationships automatically via AI
- **Shell Access**: Full bash execution for git, filesystem, and system operations
- **Web Intelligence**: Search and fetch with Brave, Tavily, and readability parsing
- **Pattern Matching**: Regex-based grep for exact code searches

### Designed for Integration
This is a **library/template** meant to be embedded in your applications:
- REST APIs and web services
- CLI tools
- Background workers
- Any Node.js application

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm
- Docker (for Graphiti memory)
- API Keys:
  - OpenRouter ([get one free](https://openrouter.ai/))
  - Google Generative AI ([get one free](https://aistudio.google.com/apikey))
  - Tavily ([get one](https://tavily.com/)) - optional
  - Brave Search ([get one](https://brave.com/search/api/)) - optional
  - OpenAI (for Graphiti entity extraction)

### Installation

```bash
pnpm install
cp .env.example .env
```

Edit `.env`:
```env
OPENROUTER_API_KEY=sk-or-v1-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
BRAVE_API_KEY=BSA...
```

### Start Memory Service (Graphiti + Neo4j)

```bash
docker compose -f docker/graphiti-compose.yml up -d
```

### Test the Agent

```bash
pnpm chat
```

This starts an interactive chat for testing. For production use, integrate the runtime into your application (see Usage section).

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
               └─► External Services
                   ├─► Graphiti (localhost:8000)
                   └─► Neo4j (localhost:7687)
```

### Native Tools

| Tool | Description |
|------|-------------|
| `shell` | Execute bash commands (git, ls, grep, etc.) |
| `web_search` | Search with Brave and/or Tavily APIs |
| `fetch_page` | Fetch and parse web pages with readability |
| `memory_add` | Add content to Graphiti knowledge graph |
| `memory_search` | Search memory for facts/relationships |
| `memory_get_episodes` | Get recent memory episodes |
| `memory_get_fact` | Get specific fact by UUID |
| `search_codebase` | Semantic RAG search |
| `grep_codebase` | Regex pattern matching |
| `plan` | Create/update implementation plans |
| `validate` | TypeScript type checking and tests |
| `ask_user` | Ask user a question |
| `task_complete` | Signal task completion |

### Graphiti Memory

Graphiti (by Zep) provides intelligent memory:
- **Automatic Entity Extraction**: AI extracts entities and relationships
- **Temporal Awareness**: Tracks how knowledge changes over time
- **Hybrid Search**: Semantic + keyword + graph traversal
- **Runs via Docker**: Neo4j + Graphiti REST API

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
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | For RAG embeddings |
| `OPENAI_API_KEY` | Yes | For Graphiti entity extraction |
| `TAVILY_API_KEY` | No | Tavily search API |
| `BRAVE_API_KEY` | No | Brave search API |
| `GRAPHITI_URL` | No | Graphiti API URL (default: http://localhost:8000) |

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
│   ├── memory.ts             # Graphiti API client
│   ├── codebase.ts           # RAG + grep tools
│   ├── agent.ts              # ask_user, task_complete
│   └── workflow.ts           # plan, validate tools
│
├── core/                      # Core domain logic
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
└── graphiti-compose.yml      # Neo4j + Graphiti services
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
