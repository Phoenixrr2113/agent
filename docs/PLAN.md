# Self-Building Agent - Project Plan

## Core Concept
An autonomous agent that starts with basic MCP tools and iteratively builds itself into a specialized agent (e.g., business analysis agent) through self-improvement loops.

## What You Actually Need (TL;DR)

**Files:** 8 total (~300 lines of code)
- `docker-compose.yml` - 2 containers (agent + knowledge graph)
- `Dockerfile` - Node.js container
- `package.json` - 4 dependencies
- `src/index.ts` - ~70 lines (entire agent)
- `src/prompts.ts` - ~20 lines (system prompt)
- `tsconfig.json` - Standard TypeScript config
- `.env` - 1 API key
- `README.md` - Quick start guide

**External Services:** 0 (everything runs in Docker)

**Cost:** $0 (uses free OpenRouter/Groq models)

**MCP Servers:** 3
1. Graphiti (knowledge graph memory) - HTTP
2. Filesystem (read/write code) - stdio
3. Git (version control) - stdio

**Setup Time:** ~5 minutes
```bash
git clone <repo>
cp .env.example .env  # Add free API key
docker-compose up     # Done!
```

## How It Works
The agent is simply:
1. An LLM (via OpenRouter/Groq + Vercel AI SDK) - **100% Free Options Available**
2. MCP tools (filesystem, git, web search, knowledge graph memory)
3. A system prompt that says "build yourself into a [type] agent"
4. A simple loop that runs continuously

## Free LLM Options

**OpenRouter (Recommended):**
- Free models available: `meta-llama/llama-3.2-3b-instruct:free`, `google/gemini-flash-1.5:free`
- Get free API key at: https://openrouter.ai/
- No credit card required for free tier
- Rate limits are generous for development

**Groq (Alternative):**
- Free tier with fast inference
- Models: `llama-3.2-3b-preview`, `gemini-flash-1.5`
- Get free API key at: https://console.groq.com/
- Excellent for development and testing

**For Graphiti Knowledge Graph:**
- Can use same OpenRouter/Groq API key
- Supports free embedding models
- No separate service needed

## Minimal Architecture

**100% Free & Self-Contained - No External Services Required**

```
agent/
├── docker-compose.yml     # Orchestrates: agent + graphiti-memory
├── Dockerfile             # Agent container (Node.js + TypeScript)
├── src/
│   ├── index.ts           # Main agent loop + MCP client setup
│   └── prompts.ts         # System prompt
├── logs/                  # Mounted volume for logs
├── workspace/             # Mounted volume for agent's files
├── .env.example           # Template for environment variables
├── .env                   # Your API keys (gitignored)
├── package.json
└── tsconfig.json
```

**That's it! No config files, no extra abstraction layers.**

**Docker Services (Only 2 Containers):**
```yaml
services:
  agent:                   # Main agent (Node.js/TypeScript)
  graphiti-memory:         # Graphiti MCP + FalkorDB (knowledge graph)
```

**What Each File Does:**

1. **`src/index.ts`** (~100 lines)
   - Initialize MCP clients (Graphiti HTTP + stdio servers)
   - Main agent loop with `streamText`
   - Logging to files
   - That's the entire agent!

2. **`src/prompts.ts`** (~20 lines)
   - System prompt string
   - Agent goal/instructions

3. **`docker-compose.yml`** (~30 lines)
   - Agent container
   - Graphiti container
   - Volume mounts

4. **`.env`** (~5 lines)
   - `OPENROUTER_API_KEY` or `GROQ_API_KEY`
   - Optional: Graphiti config

**Free Services Used:**
- **LLM**: OpenRouter with free models (Llama 3.2, Gemini Flash, etc.)
- **Knowledge Graph**: Graphiti MCP Server + FalkorDB (100% free, open source)
- **Search**: DuckDuckGo via MCP (no API key required)
- **Filesystem/Git**: Official MCP servers (stdio, run in agent container)
- **Embeddings**: Free models via OpenRouter

## Complete Agent Implementation

**Everything you need in `src/index.ts`:**

```typescript
import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { streamText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'fs/promises';

// 1. Initialize MCP Clients
const graphitiClient = await experimental_createMCPClient({
  transport: {
    type: 'http',
    url: process.env.GRAPHITI_URL || 'http://graphiti-memory:8000/mcp/',
  },
});

const filesystemClient = await experimental_createMCPClient({
  transport: new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
  }),
});

const gitClient = await experimental_createMCPClient({
  transport: new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'mcp-server-git'],
  }),
});

// 2. Combine all tools
const tools = {
  ...await graphitiClient.tools(),
  ...await filesystemClient.tools(),
  ...await gitClient.tools(),
};

// 3. Agent loop
const history = [];
let stopped = false;

while (!stopped) {
  const result = streamText({
    model: openai(process.env.MODEL || 'gpt-4o'),
    messages: history,
    tools,
    system: systemPrompt,
    stopWhen: stepCountIs(5),
    onFinish: async () => {
      await graphitiClient.close();
      await filesystemClient.close();
      await gitClient.close();
    },
  });

  // Stream and log
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    await fs.appendFile('./logs/agent.log', chunk);
  }

  // Update history
  const response = await result;
  history.push(...response.messages);

  // Log iteration
  await fs.appendFile(
    './logs/iterations.jsonl',
    JSON.stringify({ timestamp: Date.now(), ...response }) + '\n'
  );
}
```

**That's the entire agent! ~70 lines of code.**

**What This Does:**
1. **Connects to MCP servers** (Graphiti via HTTP, filesystem/git via stdio)
2. **Combines all tools** into one object
3. **Runs agent loop** with multi-step tool calling
4. **Logs everything** to files for analysis
5. **Manages resources** (closes MCP clients when done)

**Key Implementation Details:**
- No config files needed - everything in code
- MCP clients initialized directly with transport config
- Tools automatically discovered and executed by AI SDK
- Multi-step behavior with `stopWhen: stepCountIs(5)`
- Proper cleanup in `onFinish` callback
- Logs streamed to console and files
- Multi-modal support built-in (can add images/files to messages)

## What MCP Tools Does the Agent Need?

**For a self-building agent, we need exactly 3 MCP servers:**

### 1. **Graphiti MCP Server** (Knowledge Graph Memory)
**Why:** Agent needs to remember what it's learned, decisions made, and track its evolution over time.

**What it provides:**
- Temporally-aware knowledge graph (tracks when things happened)
- Entity extraction (automatically identifies people, concepts, requirements, etc.)
- Semantic search (find relevant memories)
- Episode management (store conversations, decisions, learnings)

**Setup:**
- Docker: `falkordb/graphiti-knowledge-graph-mcp`
- Transport: HTTP at `http://graphiti-memory:8000/mcp/`
- Runs in separate container
- Free LLM/embeddings via OpenRouter or Groq

**Tools provided:**
- `add_episode` - Store new information/experiences
- `search_nodes` - Find relevant entities
- `search_facts` - Find relationships between entities
- `get_episodes` - Retrieve past experiences

### 2. **Filesystem MCP Server** (Read/Write Code)
**Why:** Agent needs to modify its own code and create new files.

**What it provides:**
- Read files
- Write files
- List directories
- Create/delete files

**Setup:**
- Package: `@modelcontextprotocol/server-filesystem`
- Transport: stdio (runs in agent container via npx)
- Workspace: `/workspace` (mounted volume)

**Tools provided:**
- `read_file`
- `write_file`
- `list_directory`
- `create_directory`

### 3. **Git MCP Server** (Version Control)
**Why:** Agent needs to commit changes, track versions, and manage its codebase.

**What it provides:**
- Git operations (commit, push, pull, branch)
- View history
- Diff changes

**Setup:**
- Package: `mcp-server-git`
- Transport: stdio (runs in agent container via npx)

**Tools provided:**
- `git_commit`
- `git_status`
- `git_diff`
- `git_log`

---

**That's it! Just 3 MCP servers.**

**Optional (Stretch Goals):**
- **Search MCP** (DuckDuckGo) - For researching solutions
- **Fetch MCP** - For reading documentation
- **Sandbox MCP** (custom) - For safe testing

**Why so minimal?**
- Agent can build additional tools if it needs them
- Keeps initial complexity low
- Easier to debug and understand
- Faster startup time
- Less resource usage

## System Prompt Strategy

The system prompt tells the agent:
- What it is (e.g., "You are a business analysis agent")
- What its goal is (e.g., "Build yourself into a fully capable business analysis tool")
- What tools it has access to
- That it can modify its own code via filesystem and git tools
- To work iteratively and commit changes

## Example Agent Flow

```
Iteration 1:
  Agent: "I am a business analysis agent. What can I do?"
  Agent: "I should be able to load and analyze data. Let me add that capability."
  → Modifies code to add data loading
  → Commits changes
  
Iteration 2:
  Agent: "I can load data now. I should add visualization."
  → Researches visualization libraries
  → Adds charting capability
  → Commits changes
  
Iteration 3:
  Agent: "I should be able to generate reports."
  → Implements report generation
  → Commits changes
  
...continues building itself...
```

## Multi-modal Support

The agent is built with multi-modal capabilities from the start, allowing it to work with text, images, and files.

**Message Structure:**
```typescript
// Messages can include multiple content parts
const message = {
  role: 'user',
  content: [
    { type: 'text', text: 'Analyze this diagram' },
    {
      type: 'image',
      image: await fs.readFile('./diagram.png').then(buffer =>
        `data:image/png;base64,${buffer.toString('base64')}`
      )
    }
  ]
};

history.push(message);
```

**Use Cases:**
- Agent can analyze visualizations of its own metrics/logs
- Can process diagrams or architecture images from documentation
- Can generate and analyze charts/graphs of its progress
- Tool results can include images (e.g., screenshots, generated charts)

**Implementation:**
- Convert files to data URLs before adding to messages
- Support common formats: PNG, JPEG, PDF, etc.
- Log multi-modal content for later analysis
- Tools can return image data in results

## Logging & Analysis

Every iteration logs:
- Timestamp
- Agent's thoughts/reasoning
- Actions taken (tool calls)
- Files modified
- Outcomes
- Errors (if any)
- **Multi-modal content** (images, files, visualizations)

This creates a complete history for analyzing:
- How the agent makes decisions
- What strategies work
- Evolution over time
- Patterns in development
- Visual progression (charts, diagrams, screenshots)

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)

**Complete File Specification:**

#### 1. `docker-compose.yml`
```yaml
version: '3.8'
services:
  graphiti-memory:
    image: falkordb/graphiti-knowledge-graph-mcp:latest
    ports:
      - "8000:8000"
      - "6379:6379"
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=${OPENROUTER_API_KEY}
      - GRAPHITI_GROUP_ID=agent
    volumes:
      - graphiti-data:/data

  agent:
    build: .
    depends_on:
      - graphiti-memory
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - GRAPHITI_URL=http://graphiti-memory:8000/mcp/
    volumes:
      - ./workspace:/workspace
      - ./logs:/app/logs
    stdin_open: true
    tty: true

volumes:
  graphiti-data:
```

#### 2. `Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
CMD ["node", "dist/index.js"]
```

#### 3. `package.json`
```json
{
  "name": "self-building-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/mcp": "^0.1.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

#### 4. `.env.example`
```bash
# Free LLM API Key (choose one)
OPENROUTER_API_KEY=sk-or-v1-...
# OR
GROQ_API_KEY=gsk_...

# Model to use (free options)
MODEL=meta-llama/llama-3.2-3b-instruct:free
# OR
# MODEL=google/gemini-flash-1.5:free
```

#### 5. `src/index.ts` (Complete Implementation)
See "Complete Agent Implementation" section above (~70 lines)

#### 6. `src/prompts.ts`
```typescript
export const systemPrompt = `
You are a self-building AI agent. Your goal is to build yourself into a capable business analysis agent.

You have access to:
- Knowledge graph memory (store and retrieve information)
- Filesystem (read/write your own code)
- Git (commit changes to version control)

Your workflow:
1. Assess your current capabilities
2. Identify what you need to build next
3. Research and plan the implementation
4. Write the code
5. Test it
6. Commit changes with meaningful messages
7. Store learnings in your knowledge graph
8. Repeat

Work iteratively. Build one capability at a time. Always commit working code.
`;
```

#### 7. `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

#### 8. `README.md`
```markdown
# Self-Building Agent

A minimal AI agent that builds itself using MCP tools.

## Quick Start

1. Clone and configure:
   ```bash
   git clone <repo>
   cd self-building-agent
   cp .env.example .env
   # Add your OPENROUTER_API_KEY to .env
   ```

2. Start:
   ```bash
   docker-compose up
   ```

3. Watch it build itself!

## Requirements
- Docker & Docker Compose
- Free OpenRouter API key (https://openrouter.ai/)
```

**That's everything! 8 files total, ~300 lines of code.**

### Phase 2: First Self-Building Test
- [ ] Set goal: "Build yourself into a business analysis agent"
- [ ] Run agent loop
- [ ] Monitor and observe
- [ ] Analyze logs
- [ ] Iterate on system prompt if needed

### Phase 3: Refinement
- [ ] Improve logging/observability
- [ ] Add stop/start controls
- [ ] Optimize system prompt
- [ ] Add conversation history management
- [ ] Performance tuning

## Stretch Goals (Future Enhancements)

### Automatic Code Indexing
**Goal:** Agent has automatic awareness of its own codebase (like a context engine)

**Implementation (using AI SDK RAG patterns):**
```typescript
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

// 1. Index codebase on startup
const codeChunks = await chunkCodebase('./src');
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: codeChunks.map(chunk => chunk.content),
});

// Store embeddings with metadata
const codeIndex = codeChunks.map((chunk, i) => ({
  ...chunk,
  embedding: embeddings[i],
}));

// 2. Add retrieval tool for the agent
const tools = {
  ...await mcpClient.tools(),
  getRelevantCode: tool({
    description: 'Search your own codebase for relevant code',
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: query,
      });

      // Find most similar code chunks
      const relevant = findMostSimilar(codeIndex, embedding, topK: 5);
      return relevant.map(r => r.content).join('\n\n');
    },
  }),
};
```

**Benefits:**
- Agent can semantically search its own code
- More efficient than reading entire files
- Scales to larger codebases
- Uses proven RAG patterns from AI SDK

### Sandbox Testing Environment
**Goal:** Safe experimentation before modifying main codebase

**Implementation (Custom MCP Server):**

Create a custom MCP server that provides sandbox tools:

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';

const execAsync = promisify(exec);

const sandboxTools = {
  create_sandbox: tool({
    description: 'Create isolated copy of codebase for testing changes',
    inputSchema: z.object({
      name: z.string().describe('Name for this sandbox experiment'),
    }),
    execute: async ({ name }) => {
      const sandboxPath = `./sandboxes/${name}-${Date.now()}`;
      await fs.copy('./src', sandboxPath);
      await execAsync(`cd ${sandboxPath} && npm install`);
      return { sandboxId: name, path: sandboxPath };
    },
  }),

  run_in_sandbox: tool({
    description: 'Execute command in sandbox environment',
    inputSchema: z.object({
      sandboxPath: z.string(),
      command: z.string(),
    }),
    execute: async ({ sandboxPath, command }) => {
      const { stdout, stderr } = await execAsync(
        `cd ${sandboxPath} && ${command}`
      );
      return { stdout, stderr, success: !stderr };
    },
  }),

  merge_sandbox: tool({
    description: 'Merge successful sandbox changes back to main codebase',
    inputSchema: z.object({
      sandboxPath: z.string(),
    }),
    execute: async ({ sandboxPath }) => {
      await fs.copy(sandboxPath, './src', { overwrite: true });
      return { merged: true };
    },
  }),

  delete_sandbox: tool({
    description: 'Clean up sandbox environment',
    inputSchema: z.object({
      sandboxPath: z.string(),
    }),
    execute: async ({ sandboxPath }) => {
      await fs.remove(sandboxPath);
      return { deleted: true };
    },
  }),
};
```

**Workflow:**
```
1. Agent: create_sandbox({ name: 'add-feature-x' })
   → Returns: { sandboxId, path: './sandboxes/add-feature-x-1234567890' }

2. Agent uses filesystem tools to modify files in sandbox path

3. Agent: run_in_sandbox({ sandboxPath, command: 'npm test' })
   → Returns: { stdout, stderr, success: true }

4. If tests pass:
   → merge_sandbox({ sandboxPath })
   → Use git tool to commit changes
   → delete_sandbox({ sandboxPath })

5. If tests fail:
   → Agent analyzes errors
   → Modifies code in sandbox
   → Runs tests again
   → Repeat until working or give up
   → delete_sandbox({ sandboxPath })
```

**Benefits:**
- Safe experimentation without breaking main codebase
- Can test multiple approaches in parallel (multiple sandboxes)
- Learn from failures without consequences
- Automatic cleanup of failed experiments

**Integration:**
```typescript
// Combine sandbox tools with MCP tools
const allTools = {
  ...await mcpClient.tools(),
  ...sandboxTools,
};
```

### Computer Use (Future Enhancement)
**Goal:** Allow agent to interact with desktop environment and browsers

**Implementation (Using Provider-Defined Tools):**

Some providers like Anthropic offer built-in computer use tools:

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const result = streamText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  messages: history,
  tools: {
    ...await mcpClient.tools(),
    // Provider-defined computer use tools
    computer: anthropic.tools.computer_20250124({
      displayWidthPx: 1024,
      displayHeightPx: 768,
      execute: async ({ action, coordinate, text }) => {
        // Custom implementation for:
        // - Taking screenshots
        // - Moving mouse
        // - Clicking
        // - Typing text
        // - Scrolling

        // Return image of screen state
        return {
          type: 'image',
          data: screenshotBase64,
        };
      },
    }),
  },
});
```

**Use Cases:**
- Agent can test its own UI if it builds one
- Can interact with web-based tools and services
- Can verify visual output of generated code
- Can perform end-to-end testing in browsers

**Note:** This is a lower priority feature. The agent can build most capabilities without computer use. Consider implementing only if the agent identifies a specific need for it.

## Success Metrics

- Agent successfully modifies its own code
- Changes are committed to git with meaningful messages
- Agent builds new capabilities over time
- No catastrophic failures (agent breaking itself)
- Clear progression toward stated goal

## Technical Implementation Notes

### AI SDK Best Practices (from documentation)

**Multi-Step Tool Calling:**
- Use `stopWhen: stepCountIs(n)` to allow the agent to call multiple tools in sequence
- The AI SDK automatically sends tool results back to the model for the next step
- Access all steps via `result.steps` or in `onStepFinish` callback
- Each step contains: text, toolCalls, toolResults, finishReason, usage

**MCP Client Management:**
- Always close MCP clients to free resources
- For streaming: close in `onFinish` callback
- For non-streaming: use try/finally blocks
- Multiple MCP clients can be used simultaneously (merge tool sets)

**Message Handling:**
- Use `response.messages` to get assistant and tool messages
- Push these to conversation history for context
- Use `convertToModelMessages` when needed for UI messages

**Tool Execution:**
- Tools execute automatically when model calls them
- No need to manually handle tool execution
- Tool results are automatically added to message history
- Use `onStepFinish` to observe tool calls and results
- Tools can return multi-modal content (text, images, files)

**Multi-modal Messages:**
- Messages can contain multiple content parts (text, image, file)
- Convert files to data URLs: `data:image/png;base64,${buffer.toString('base64')}`
- Supported in both user messages and tool results
- Log multi-modal content for analysis

**Error Handling:**
- Tool execution errors appear as `tool-error` content parts
- Use `onError` callback to handle errors gracefully
- MCP client errors should trigger cleanup (close clients)

### Project Structure Notes

- Start simple, add complexity only if needed
- The agent itself can build additional tooling if it decides it needs it
- Focus on observability - we want to understand how it thinks
- Safety is not a primary concern initially (can add later)
- All complexity (testing frameworks, knowledge graphs, etc.) can emerge from the simple base
- **Everything runs locally in Docker** - no cloud dependencies
- **100% free to run** - only requires free API keys

### Key Differences from Initial Assumptions

1. **No manual tool execution needed** - AI SDK handles this automatically
2. **MCP clients must be closed** - Resource management is critical
3. **Multi-step is built-in** - Use `stopWhen` instead of manual loops
4. **Message history is automatic** - Use `response.messages` to update history
5. **Docker-first architecture** - All services containerized for easy distribution
6. **Free services only** - No paid dependencies required

## Deployment & Distribution

**Template Repository Structure:**
```
agent-template/
├── docker-compose.yml
├── .env.example
├── README.md              # Quick start guide
├── src/                   # Agent source code
├── logs/                  # Mounted volume
└── workspace/             # Agent's working directory
```

**One-Command Setup:**
```bash
# Clone template
git clone https://github.com/your-org/self-building-agent-template
cd self-building-agent-template

# Configure (add your free API keys)
cp .env.example .env
nano .env  # Add OPENROUTER_API_KEY or GROQ_API_KEY

# Start everything
docker-compose up -d

# View logs
docker-compose logs -f agent
```

**No External Services Required:**
- ✅ All services run in Docker containers
- ✅ Only need free API keys (OpenRouter or Groq)
- ✅ Knowledge graph runs locally (FalkorDB)
- ✅ Search uses DuckDuckGo (no API key)
- ✅ All MCP servers are open source
- ✅ Works on any machine with Docker

**Distribution:**
- Publish as GitHub template repository
- Include comprehensive README with setup instructions
- Provide example `.env.example` with free service options
- Document how to get free API keys
- Include troubleshooting guide

