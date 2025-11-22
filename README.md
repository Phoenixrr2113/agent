# Generic Agent Template

A self-building AI agent template built with TypeScript, featuring RAG-powered codebase search, MCP tool integration, and intelligent code understanding.

## 🌟 Features

### Core Capabilities
- **Generic Template**: No hard-coded purpose - adapts to user needs
- **RAG-Powered Search**: Semantic codebase search with intelligent chunking
- **MCP Integration**: Extensible tool system via Model Context Protocol
- **Self-Awareness**: Uses its own tools to understand and modify itself
- **Iterative Development**: Builds capabilities one step at a time

### Advanced Features
- **Intelligent Chunking**: Adaptive, semantic, and fixed strategies
- **Smart Caching**: File-based embedding cache with hash validation
- **Pattern Matching**: Regex-based grep for exact searches
- **Knowledge Graph**: Persistent memory across sessions
- **Web Access**: Fetch and process web content
- **Sequential Thinking**: Structured problem-solving

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- OpenRouter API key ([get one free](https://openrouter.ai/))
- OpenAI API key (for embeddings)

### Installation

```bash
npm install
cp .env.example .env

```

Edit `.env` and add your API keys:
```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...
MODEL=qwen/qwen3-coder:free
```

### Run

```bash
npm run dev
```

### Docker

```bash
docker-compose up
```

## 📚 Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Main Loop                         │
│                   (src/index.ts)                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               ├─► RAG System (src/rag.ts)
               │   ├─► Intelligent Chunking (src/chunking.ts)
               │   ├─► Embedding Cache (src/cache.ts)
               │   └─► Vector Search
               │
               ├─► MCP Clients (src/mcp-client.ts)
               │   ├─► Filesystem
               │   ├─► Git
               │   ├─► Fetch
               │   ├─► Memory
               │   └─► Sequential Thinking
               │
               └─► Grep Tool (src/grep.ts)
```

### Key Components

#### RAG System
- **Location**: `src/rag.ts`
- **Purpose**: Semantic code search using embeddings
- **Features**:
  - Multiple chunking strategies (adaptive, semantic, fixed)
  - Per-file caching with content hashing
  - Configurable similarity thresholds
  - Incremental indexing

#### Chunking Strategies
- **Location**: `src/chunking.ts`
- **Strategies**:
  - **Fixed**: Simple line-based chunking
  - **Semantic**: Respects function/class boundaries
  - **Adaptive**: Considers brace depth and structure

#### Caching System
- **Location**: `src/cache.ts`
- **Features**:
  - File-based storage
  - Content hash validation
  - Automatic invalidation
  - Generic type support

#### MCP Integration
- **Location**: `src/mcp-client.ts`
- **Purpose**: Communicate with MCP servers
- **Protocol**: JSON-RPC over stdio

## 🧪 Testing

### Test Structure

```
tests/
├── fixtures/          # Sample code for testing
├── helpers/           # Test utilities and mock servers
├── integration/       # Integration tests (real implementations)
└── e2e/              # End-to-end tests (full workflows)
```

### Running Tests

```bash
npm test                 # All tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # E2E tests
npm run test:watch      # Watch mode
```

### Test Coverage
- **Unit Tests**: 46 tests (mocked dependencies)
- **Integration Tests**: 22 tests (real implementations)
- **E2E Tests**: Full agent workflows

## ⚙️ Configuration

### RAG Options

```typescript
const rag = createCodebaseRAG('/workspace', {
  chunkingStrategy: 'adaptive',  // 'fixed' | 'semantic' | 'adaptive'
  chunkSize: 100,                 // Lines per chunk
  enableCache: true,              // Enable embedding cache
});
```

### Available Models

Free options via OpenRouter:
- `qwen/qwen3-coder:free` (default, great for code)
- `deepseek/deepseek-chat-v3-0324:free`
- `tngtech/deepseek-r1t2-chimera:free`

## 📖 Usage Examples

### Semantic Code Search

```typescript
const rag = createCodebaseRAG('/workspace');
await rag.indexCodebase();

const results = await rag.searchCodebase('calculate sum of numbers', 5);
```

### Pattern Matching

```typescript
const results = await grepWorkspace('function\\s+\\w+', '/workspace', {
  filePattern: '\\.ts$',
  ignoreCase: false,
  maxResults: 100,
});
```

### MCP Tool Usage

```typescript
const client = createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']);
await client.initialize();

const tools = await client.listTools();
const result = await client.callTool('read_file', { path: '/workspace/file.ts' });
```

## 🔧 Development

### Project Structure

```
src/
├── index.ts           # Main agent loop
├── prompts.ts         # System prompts
├── rag.ts            # RAG implementation
├── chunking.ts       # Chunking strategies
├── cache.ts          # Caching system
├── grep.ts           # Pattern matching
├── mcp-client.ts     # MCP client
└── tools.ts          # Tool mapping

tests/
├── fixtures/         # Test data
├── helpers/          # Test utilities
├── integration/      # Integration tests
└── e2e/             # E2E tests
```

### Adding New Features

1. **Search for patterns**: Use `search_codebase` or `grep_codebase`
2. **Read relevant files**: Understand existing implementation
3. **Plan changes**: Use sequential thinking
4. **Implement**: Follow functional patterns
5. **Test**: Write unit and integration tests
6. **Commit**: Clear, descriptive messages

### Coding Standards

- **Functional Programming**: Factory functions, closures (no classes)
- **TypeScript**: Strong typing throughout
- **Testing**: Unit, integration, and E2E tests
- **Documentation**: Inline comments for complex logic only

## 🎯 Use Cases

### Code Analysis Agent
Configure the agent to analyze code quality, find bugs, and suggest improvements.

### Documentation Agent
Build an agent that generates comprehensive documentation from codebases.

### Refactoring Agent
Create an agent that identifies and performs safe refactorings.

### Testing Agent
Develop an agent that writes tests for existing code.

## 🤝 Contributing

This is a template - fork it and build your own agent!

### Adding MCP Servers

```typescript
const newClient = createStdioMCPClient('command', ['args']);
await newClient.initialize();
const tools = await newClient.listTools();
```

### Custom Tools

```typescript
const customTools = {
  my_tool: {
    description: 'Does something useful',
    parameters: z.object({
      input: z.string(),
    }),
    execute: async ({ input }) => {
      return doSomething(input);
    },
  },
};
```

## 📝 License

MIT

## 🙏 Acknowledgments

- Built with [Vercel AI SDK](https://sdk.vercel.ai/)
- Uses [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by [OpenRouter](https://openrouter.ai/)
- Embeddings from [OpenAI](https://openai.com/)

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues and documentation
- Review the test suite for examples
