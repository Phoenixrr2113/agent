# @agent/sdk

Opinionated AI agent SDK built on [Vercel AI SDK](https://sdk.vercel.ai/) with tool presets, sub-agents, transient streaming, and workflow durability.

## Installation

```bash
pnpm add @agent/sdk
# or
npm install @agent/sdk
```

## Quick Start

```typescript
import { createAgent } from '@agent/sdk';

// Create an agent with default tools
const agent = createAgent({
  role: 'coder',
  toolPreset: 'standard',
  workspaceRoot: process.cwd(),
});

// Generate a response
const result = await agent.generate({
  prompt: 'Read the package.json and summarize the dependencies',
});

console.log(result.text);
```

## createAgent API

```typescript
interface AgentOptions {
  // Identity
  systemPrompt?: string;
  role?: 'generic' | 'coder' | 'researcher' | 'analyst';
  
  // Execution
  maxSteps?: number;           // Default: 50
  stopWhen?: StopFunction;     // Custom stop condition
  
  // Model
  model?: LanguageModel;       // AI SDK model instance
  modelProvider?: 'openrouter' | 'ollama' | 'openai' | 'anthropic';
  modelName?: string;
  
  // Tools
  toolPreset?: 'none' | 'minimal' | 'standard' | 'full';
  tools?: Record<string, Tool>;
  enableTools?: string[];
  disableTools?: string[];
  
  // Sub-Agents
  enableSubAgents?: boolean;
  maxSpawnDepth?: number;      // Default: 3
  
  // Features
  enableTransientStreaming?: boolean;  // Default: true
  durable?: boolean;                   // Workflow durability
  enableMemory?: boolean;              // Semantic memory
  
  // Environment
  workspaceRoot?: string;
}
```

## Tool Presets

| Preset | Tools Included |
|--------|----------------|
| `none` | No tools |
| `minimal` | `read_text_file`, `list_directory`, `get_file_info` |
| `standard` | Filesystem, shell, plan, reasoning |
| `full` | Standard + memory + spawn_agent |

```typescript
import { createToolPreset } from '@agent/sdk';

const tools = createToolPreset('standard', {
  workspaceRoot: '/my/project',
});
```

## Sub-Agents

Spawn specialized sub-agents for complex tasks:

```typescript
const agent = createAgent({
  enableSubAgents: true,
  maxSpawnDepth: 3,
});

// Agent can now use spawn_agent tool to delegate work
```

## Transient Streaming

Large outputs (file contents, shell output, reasoning steps) are streamed transiently - visible in UI but not added to context window.

```typescript
const agent = createAgent({
  enableTransientStreaming: true,  // Default
});

// Subscribe to transient events
const stream = agent.stream({ prompt: '...' });
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'data-file-content') {
    console.log('File:', chunk.data.path);
  }
}
```

## Data Part Types

Custom streaming data parts:
- `sub-agent-stream` - Sub-agent progress
- `file-content` - File contents (transient)
- `shell-output` - Command output (transient)
- `tool-progress` - Tool execution progress
- `reasoning-step` - Thought chain steps
- `search-result` - Search results
- `memory-result` - Memory retrieval

## Workflow Integration

For durable, resumable agent execution:

```typescript
import { createAgent } from '@agent/sdk';
import { createDurableAgent } from '@agent/sdk/workflow';

const agent = createDurableAgent({
  durable: true,
  workflowOptions: {
    taskQueue: 'agent-tasks',
  },
});
```

## License

MIT
