# Opinionated Agent Package

Create `packages/agent` - an opinionated extension of AI SDK's `ToolLoopAgent` with batteries included.

## Philosophy

> **Extend, don't wrap.** Build on top of `ToolLoopAgent`, not around it.

The package provides:
- 🔧 **Curated tools** - fs, shell, web, memory out of the box
- 📝 **Sensible prompts** - Role-based instructions that work
- 🔄 **Smart defaults** - `stopWhen` checks for `task_complete`
- 🧠 **Context management** - Auto-summarization for long conversations
- 🤖 **Sub-agent spawning** - Built-in delegation capabilities

---

## Package Structure

```
packages/agent/
├── src/
│   ├── index.ts              # Main exports
│   ├── agent.ts              # OpinionatedAgent class
│   ├── tools/                # Built-in tools
│   │   ├── index.ts
│   │   ├── filesystem.ts     # fs operations
│   │   ├── shell.ts          # Command execution
│   │   ├── web.ts            # Search + fetch
│   │   ├── memory.ts         # Knowledge graph (optional)
│   │   ├── task.ts           # task_complete, ask_user
│   │   └── spawn.ts          # Sub-agent spawning
│   ├── prompts/
│   │   ├── base.ts           # Core prompt
│   │   └── roles.ts          # coder, researcher, analyst
│   ├── presets/
│   │   └── index.ts          # Tool presets
│   └── utils/
│       └── context.ts        # Summarization
├── package.json
└── tsconfig.json
```

---

## Core API Design

### OpinionatedAgent Class

```typescript
import { ToolLoopAgent, stepCountIs } from 'ai';

export class OpinionatedAgent extends ToolLoopAgent {
  constructor(options: AgentOptions = {}) {
    const {
      role = 'generic',
      tools: customTools,
      toolPreset = 'standard',
      systemPrompt,
      maxSteps = 50,
      workspaceRoot = process.cwd(),
      enableSpawning = true,
      enableMemory = false,
      ...rest
    } = options;

    // Build tool set
    const builtInTools = buildToolSet({ 
      preset: toolPreset, 
      workspaceRoot,
      enableSpawning,
      enableMemory,
    });
    const allTools = { ...builtInTools, ...customTools };

    // Build prompt
    const instructions = systemPrompt ?? buildPrompt(role);

    // Custom stop condition
    const stopWhen = options.stopWhen ?? [
      stepCountIs(maxSteps),
      taskCompleteCondition(),
    ];

    super({
      model: options.model ?? 'anthropic/claude-sonnet-4',
      instructions,
      tools: allTools,
      stopWhen,
      prepareStep: buildPrepareStep(options),
      onStepFinish: options.onStepFinish,
      ...rest,
    });
  }
}
```

### Configuration Options

```typescript
export interface AgentOptions {
  // Model
  model?: LanguageModel | string;
  
  // Identity
  role?: 'generic' | 'coder' | 'researcher' | 'analyst';
  systemPrompt?: string;  // Override default
  
  // Tools
  toolPreset?: 'minimal' | 'standard' | 'full' | 'none';
  tools?: ToolSet;
  
  // Execution
  maxSteps?: number;
  stopWhen?: StopCondition;
  
  // Features
  enableSpawning?: boolean;   // Sub-agent delegation
  enableMemory?: boolean;     // Knowledge graph (requires SQLite)
  
  // Environment
  workspaceRoot?: string;
  
  // Callbacks
  onStepFinish?: StepFinishCallback;
  onSpawn?: SpawnCallback;
}
```

---

## Tool Presets

| Preset | Tools Included |
|--------|----------------|
| `none` | Only `task_complete`, `ask_user` |
| `minimal` | + `fs`, `shell` |
| `standard` | + `web` |
| `full` | + `memory`, `spawn_agent` |

---

## Built-in Tools

### 1. `fs` - Filesystem Operations

```typescript
const fs = tool({
  description: 'File operations: read, write, edit, list, glob, grep',
  parameters: z.object({
    action: z.enum(['read', 'write', 'edit', 'list', 'glob', 'grep']),
    path: z.string(),
    content: z.string().optional(),
    pattern: z.string().optional(),
  }),
  execute: async (args) => { ... },
});
```

### 2. `shell` - Command Execution

```typescript
const shell = tool({
  description: 'Execute shell commands',
  parameters: z.object({
    command: z.string(),
    cwd: z.string().optional(),
  }),
  execute: async ({ command, cwd }) => { ... },
});
```

### 3. `web` - Search & Fetch

```typescript
const web = tool({
  description: 'Search the web or fetch page content',
  parameters: z.object({
    action: z.enum(['search', 'fetch']),
    query: z.string().optional(),
    url: z.string().optional(),
  }),
  execute: async (args) => { ... },
});
```

### 4. `spawn_agent` - Sub-Agent Delegation

```typescript
const spawn_agent = tool({
  description: 'Delegate task to specialized sub-agent',
  parameters: z.object({
    task: z.string(),
    role: z.enum(['coder', 'researcher', 'analyst']).optional(),
  }),
  execute: async ({ task, role }, { agent }) => {
    const subAgent = new OpinionatedAgent({
      role,
      enableSpawning: false,  // Prevent recursion
    });
    return subAgent.run({ prompt: task });
  },
});
```

### 5. `task_complete` - Signal Completion

```typescript
const task_complete = tool({
  description: 'Signal that the task is complete',
  parameters: z.object({
    summary: z.string(),
  }),
  execute: async ({ summary }) => summary,
});
```

---

## Usage Examples

### Basic Usage

```typescript
import { OpinionatedAgent } from '@agent/agent';

const agent = new OpinionatedAgent();
const result = await agent.run({ prompt: 'List all TypeScript files' });
console.log(result.text);
```

### Custom Role

```typescript
const coder = new OpinionatedAgent({
  role: 'coder',
  workspaceRoot: '/path/to/project',
});

const result = await coder.run({ 
  prompt: 'Add error handling to the API routes' 
});
```

### Streaming

```typescript
const agent = new OpinionatedAgent();
const result = await agent.stream({ prompt: 'Build a REST API' });

for await (const event of result.fullStream) {
  if (event.type === 'text-delta') {
    process.stdout.write(event.text);
  }
}
```

### Custom Tools + Preset

```typescript
const agent = new OpinionatedAgent({
  toolPreset: 'minimal',
  tools: {
    database: myDatabaseTool,
    deploy: myDeployTool,
  },
});
```

---

## Implementation Order

1. [ ] Create `packages/agent/` structure
2. [ ] Port `fs` tool (simplified from current)
3. [ ] Port `shell` tool
4. [ ] Port `web` tool
5. [ ] Create `task_complete` + `ask_user`
6. [ ] Build role-based prompts
7. [ ] Create `OpinionatedAgent` class
8. [ ] Add `spawn_agent` capability
9. [ ] Add optional `memory` tool
10. [ ] Write tests
11. [ ] Create examples

---

## Differences from Current Implementation

| Current (`@agent/core`) | New (`@agent/agent`) |
|-------------------------|----------------------|
| Wraps ToolLoopAgent | Extends ToolLoopAgent |
| Heavy dependencies (device, etc) | Minimal dependencies |
| Complex initialization | Simple constructor |
| Many internal abstractions | Direct, readable code |
| Runtime-created tools | Static tool definitions |

---

## Dependencies

```json
{
  "dependencies": {
    "ai": "6.0.0-beta.120",
    "zod": "^3.25.76"
  },
  "peerDependencies": {
    "better-sqlite3": "^12.4.6"  // Only if enableMemory
  }
}
```

Minimal footprint. No native deps by default.
