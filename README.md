# Generic Agent Template

A **self-modifying** AI agent template that can build itself into whatever you need. Built with TypeScript, this agent has full access to its own codebase and can modify its code, configuration, tests, and documentation.

## 🌟 What Makes This Agent Special

### Self-Modifying Architecture
Unlike traditional agents that operate in sandboxed environments, this agent:
- **Has full root directory access** - Can read and write any file in its own codebase
- **Modifies its own code** - Can refactor, add features, and improve itself
- **No fixed purpose** - Starts as a blank template and builds itself based on your needs
- **Self-aware** - Uses RAG to understand its own codebase before making changes

### Core Capabilities
- **RAG-Powered Self-Understanding**: Semantic search over its own codebase with intelligent chunking
- **MCP Tool Integration**: Filesystem, Git, Memory, Web Fetch, and Sequential Thinking tools
- **Iterative Development**: Builds capabilities one step at a time with git commits
- **Knowledge Persistence**: Maintains a knowledge graph of learnings across sessions
- **Pattern Matching**: Regex-based grep for exact code searches

### Two Modes of Operation
1. **Autonomous Mode** (`npm run dev`) - Runs once with auto-approval
2. **Interactive Mode** (`npm run chat`) - Conversation loop with manual approval

Both modes use the same agent, just different approval and run configurations.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm (or npm)
- OpenRouter API key ([get one free](https://openrouter.ai/))
- Google Generative AI API key ([get one free](https://aistudio.google.com/apikey))

### Installation

```bash
pnpm install
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
OPENROUTER_API_KEY=sk-or-v1-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
MODEL=qwen/qwen3-coder:free
```

### Run the Agent

**Interactive Mode** (recommended for first run):
```bash
pnpm run chat
```

**Autonomous Mode** (runs in a loop):
```bash
pnpm run dev
```

### Docker

```bash
docker-compose up
```

## 📚 Architecture

### How It Works

The agent operates in a loop:
1. **Indexes its codebase** using RAG (Google Gemini embeddings)
2. **Receives a task** from the user (or continues previous work)
3. **Searches its codebase** to understand relevant code
4. **Uses MCP tools** to read files, modify code, commit changes
5. **Re-indexes** to understand what it just changed
6. **Repeats** until the task is complete

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Main Loop                         │
│              (src/index.ts or src/interactive.ts)            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ├─► RAG System (src/rag.ts)
               │   ├─► Indexes entire codebase (root directory)
               │   ├─► Intelligent Chunking (src/chunking.ts)
               │   ├─► Embedding Cache (src/cache.ts)
               │   └─► Semantic Vector Search
               │
               ├─► MCP Tool Servers
               │   ├─► Filesystem Server (read/write any file)
               │   ├─► Git Server (commit, diff, status)
               │   ├─► Memory Server (knowledge graph)
               │   ├─► Fetch Server (web access)
               │   └─► Sequential Thinking Server
               │
               └─► Grep Tool (src/grep.ts)
                   └─► Regex pattern matching across codebase
```

### Key Components

#### RAG System (`src/rag.ts`)
- **Purpose**: Semantic code search using Google Gemini embeddings
- **Scope**: Indexes the entire root directory (not sandboxed)
- **Features**:
  - Three chunking strategies: adaptive, semantic, fixed
  - Per-file caching with content hash validation
  - Configurable similarity thresholds
  - Automatic re-indexing after changes

#### Chunking Strategies (`src/chunking.ts`)
- **Fixed**: Simple line-based chunking (good for logs, configs)
- **Semantic**: Respects function/class boundaries (best for code)
- **Adaptive**: Considers brace depth and structure (balanced)

#### Caching System (`src/cache.ts`)
- **Purpose**: Cache embeddings to avoid re-embedding unchanged files
- **Storage**: File-based JSON storage in `.rag-cache/`
- **Validation**: SHA-256 content hashing to detect changes
- **Performance**: Dramatically speeds up re-indexing

#### MCP Integration (`src/mcp-client.ts`)
- **Protocol**: JSON-RPC over stdio to MCP servers
- **Servers Used**:
  - `@modelcontextprotocol/server-filesystem` - Full filesystem access
  - `@modelcontextprotocol/server-memory` - Knowledge graph storage
  - `git-mcp-server` - Git operations
  - `mcp-server-fetch` - Web content fetching
  - `@modelcontextprotocol/server-sequential-thinking` - Structured reasoning

## 🧪 Testing

### Test Structure

```
tests/
├── fixtures/          # Sample code for testing RAG and grep
├── helpers/           # Test utilities (workspace setup/teardown, mock servers)
├── integration/       # Integration tests (real MCP servers, real filesystem)
└── e2e/              # End-to-end tests (full agent workflows)
```

### Running Tests

```bash
pnpm test                 # All tests
pnpm run test:unit       # Unit tests only (mocked filesystem)
pnpm run test:integration # Integration tests (real implementations)
pnpm run test:e2e        # E2E tests (full workflows)
pnpm run test:watch      # Watch mode
```

### Test Coverage
- **Unit Tests**: 46 tests with mocked dependencies
- **Integration Tests**: 22 tests with real MCP servers
- **E2E Tests**: Full agent interaction workflows
- **Total**: 91 tests passing, 18 skipped (require API keys)

## ⚙️ Configuration

### RAG Options

```typescript
const rag = createCodebaseRAG(process.cwd(), {
  chunkingStrategy: 'adaptive',  // 'fixed' | 'semantic' | 'adaptive'
  chunkSize: 100,                 // Lines per chunk
  enableCache: true,              // Enable embedding cache
});
```

### Available LLM Models

Free options via OpenRouter:
- `qwen/qwen3-coder:free` (default, excellent for code)
- `deepseek/deepseek-chat-v3-0324:free`
- `tngtech/deepseek-r1t2-chimera:free`

Paid options (better quality):
- `anthropic/claude-sonnet-4.5`
- `openai/gpt-4o`
- `deepseek/deepseek-chat-v3`

## 📖 Usage Examples

### Ask the Agent to Build a Feature

```bash
pnpm run chat
```

```
You: I want you to add a feature that exports codebase analysis to markdown
```

The agent will:
1. Search its codebase to understand current architecture
2. Plan the implementation using sequential thinking
3. Write the code and tests
4. Commit the changes with a descriptive message

### Programmatic Usage

#### Semantic Code Search

```typescript
const rag = createCodebaseRAG(process.cwd());
await rag.indexCodebase();

// Find code related to a concept
const results = await rag.searchCodebase('calculate sum of numbers', 5);
results.forEach(r => {
  console.log(`${r.filePath}:${r.startLine}-${r.endLine}`);
  console.log(r.content);
});
```

#### Pattern Matching

```typescript
// Find all function definitions
const results = await grepWorkspace('function\\s+\\w+', process.cwd(), {
  filePattern: '\\.ts$',
  ignoreCase: false,
  maxResults: 100,
});
```

#### MCP Tool Usage

```typescript
const client = createStdioMCPClient('npx', [
  '-y',
  '@modelcontextprotocol/server-filesystem',
  process.cwd()
]);
await client.initialize();

const tools = await client.listTools();
const result = await client.callTool('read_file', {
  path: './src/index.ts'
});
```

## 🔧 Development

### Project Structure

```
src/
├── core/                      # Core domain logic
│   ├── agents/
│   │   ├── factory.ts        # createAgentWithRole
│   │   ├── models.ts         # Model configurations
│   │   └── roles.ts          # Agent role definitions & prompts
│   ├── rag/
│   │   ├── index.ts          # RAG implementation
│   │   ├── chunking.ts       # Code chunking strategies
│   │   └── cache.ts          # Embedding cache
│   └── search/
│       └── grep.ts           # Pattern matching utility
│
├── infrastructure/            # External integrations
│   ├── mcp/
│   │   ├── client.ts         # MCP protocol client
│   │   └── adapter.ts        # MCP to AI SDK adapter
│   └── prompts/
│       └── templates.ts      # System prompt templates
│
├── tools/                     # Agent tools
│   └── workflow.ts           # plan_tool, validation_tool
│
├── application/               # Application orchestration
│   ├── initialization.ts     # MCP clients, RAG setup, tool preparation
│   ├── orchestrator.ts       # Agent creation, step handling
│   └── modes/
│       ├── loop.ts           # Interactive conversation mode
│       └── once.ts           # Single execution mode
│
└── main.ts                    # Entry point (50 lines)

tests/
├── fixtures/         # Sample code for testing
├── helpers/          # Test utilities and mock MCP servers
├── integration/      # Integration tests
└── e2e/             # End-to-end tests
```

### How the Agent Develops Itself

The agent follows this workflow when adding features:

1. **Understand the Request**
   - Uses sequential thinking to break down the task
   - Asks clarifying questions if needed

2. **Research Existing Code**
   - Uses `search_codebase` to find similar patterns
   - Uses `grep_codebase` to find specific implementations
   - Reads relevant files completely

3. **Plan the Implementation**
   - Searches for existing patterns to follow
   - Looks up documentation using web fetch if needed
   - Stores research in its knowledge graph

4. **Implement Changes**
   - Follows existing code patterns and conventions
   - Makes one focused change at a time
   - Avoids over-engineering

5. **Test and Verify**
   - Writes tests for new functionality
   - Runs the test suite
   - Verifies everything works

6. **Commit and Document**
   - Commits with clear, descriptive messages
   - Updates documentation if needed
   - Stores learnings in knowledge graph

### Coding Standards

- **Functional Programming**: Factory functions and closures (no classes)
- **TypeScript**: Strong typing throughout the codebase
- **Testing**: Unit, integration, and E2E test coverage
- **Documentation**: Inline comments only for non-obvious logic
- **Commits**: Clear messages describing what and why

## 🚀 Roadmap

Current implementation is fully functional. Planned expansions (see [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed implementation guides):

- [ ] **Model Routing** - Dynamic model selection based on task complexity (fast/standard/reasoning/powerful)
- [x] **Ollama Support** - Local model integration for cost reduction (set `OLLAMA_ENABLED=true`)
- [ ] **Multi-Agent Orchestration** - Planner → Implementer → Evaluator workflow with quality-based retries
- [ ] **Context Summarization** - Intelligent context compression using summarizer agent for longer sessions
- [ ] **Parallel Processing** - Concurrent execution of independent tasks (e.g., multi-file analysis)

All expansion features are designed for zero-refactoring activation when needed.

## 🎯 What Can You Build?

This is a **template** - you can build it into anything. Some ideas:

### Code Analysis Agent
Configure it to analyze code quality, detect patterns, find bugs, and suggest improvements.

### Documentation Generator
Build an agent that reads your codebase and generates comprehensive documentation.

### Refactoring Agent
Create an agent that identifies code smells and performs safe refactorings.

### Testing Agent
Develop an agent that writes comprehensive tests for existing code.

### Custom Domain Agent
Build an agent specialized for your domain (data analysis, DevOps, web scraping, etc.)

## 🤝 Contributing

This is a template - **fork it and build your own agent!**

### Adding MCP Servers

```typescript
const newClient = createStdioMCPClient('command', ['args']);
await newClient.initialize();
const mcpTools = await newClient.listTools();
const aiTools = mapMcpToolsToAiTools(mcpTools, newClient);
```

### Adding Custom Tools

```typescript
const customTools = {
  my_tool: {
    description: 'Does something useful',
    parameters: z.object({
      input: z.string(),
    }),
    execute: async ({ input }) => {
      // Your implementation
      return JSON.stringify(result);
    },
  },
};
```

## ⚠️ Important Notes

### Security Considerations

This agent has **full access to its own filesystem** and can:
- Read and write any file in its directory
- Execute git commands
- Make web requests
- Modify its own code

**Only run this agent in a safe environment** (container, VM, or dedicated directory). Never:
- Run it with access to sensitive files outside its directory
- Give it access to production systems
- Run it with elevated privileges unless necessary

### Test Cleanup

All tests properly clean up their resources:
- Integration tests use `teardownTestWorkspace()` in `afterEach`
- Temporary files go to `tests/temp/` (gitignored)
- Cache files go to `.rag-cache/` (gitignored)
- MCP clients are closed after tests

## 📝 License

MIT

## 🙏 Acknowledgments

- Built with [Vercel AI SDK](https://sdk.vercel.ai/)
- Uses [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by [OpenRouter](https://openrouter.ai/)
- Embeddings from [Google Gemini](https://ai.google.dev/)

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues and documentation
- Review the test suite for examples
