# Agent Architecture

## Current Implementation

Pluggable runtime architecture with two entry points:

**Autonomous Mode** (`src/dev.ts`):
- Single task execution
- Auto-approves `ask_user` tool calls
- Uses runtime with default handler

**Interactive Mode** (`src/chat.ts`):
- Conversation loop
- Custom `askUserHandler` for user input
- Session-based architecture

```bash
pnpm run dev   # Autonomous development mode
pnpm run chat  # Interactive conversation mode
```

## File Structure

```
src/
├── core/                      # Core domain logic (no external dependencies)
│   ├── agents/
│   │   ├── factory.ts        # createAgentWithRole (agent creation logic)
│   │   ├── models.ts         # Model configurations (OpenRouter, Ollama)
│   │   └── roles.ts          # Agent role definitions & system prompts
│   ├── rag/
│   │   ├── index.ts          # RAG implementation (indexing, search)
│   │   ├── chunking.ts       # Code chunking strategies (fixed, semantic, adaptive)
│   │   └── cache.ts          # Embedding cache with hash validation
│   └── search/
│       └── grep.ts           # Regex pattern matching utility
│
├── infrastructure/            # External integrations & adapters
│   ├── mcp/
│   │   ├── client.ts         # MCP protocol client (JSON-RPC over stdio)
│   │   └── adapter.ts        # MCP to AI SDK tool adapter
│   └── prompts/
│       └── templates.ts      # System prompt templates
│
├── tools/                     # Agent tool definitions
│   └── workflow.ts           # plan_tool, validation_tool (workflow management)
│
├── application/               # Application orchestration & execution
│   ├── initialization.ts     # MCP client setup, RAG indexing, tool preparation
│   └── orchestrator.ts       # Agent creation, stop conditions, step handlers
│
├── runtime/                   # Pluggable runtime architecture
│   └── agent-runtime.ts      # Session-based runtime with injectable handlers
│
├── dev.ts                     # Autonomous mode entry point
├── chat.ts                    # Interactive mode entry point
└── index.ts                   # Library exports for service integration
```

## Expansion: Model Routing

Enable dynamic model selection based on task complexity.

**Implementation:**

Edit `src/main.ts`, in the `prepareStep` function:

```typescript
const prepareStep: PrepareStepFunction<typeof tools> = ({ messages, step }) => {
  const lastMessage = messages[messages.length - 1];
  const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

  // Route to appropriate model
  if (content.includes('complex') || content.includes('debug') || content.includes('reason')) {
    return { messages, model: models.reasoning() };
  }

  if (content.includes('simple') || content.includes('quick') || content.includes('plan')) {
    return { messages, model: models.fast() };
  }

  // Context trimming logic here...
  return { messages };
};
```

**Model definitions in `src/agents.ts`:**
- `fast` - Quick tasks, planning
- `standard` - Most development work
- `reasoning` - Complex debugging, architecture decisions
- `powerful` - Critical tasks (Claude Sonnet 4.5)

## Expansion: Ollama Support

Switch to local models for cost reduction.

**Implementation:**

1. Install the Ollama provider:
```bash
pnpm add ollama-ai-provider-v2
```

2. Pull models:
```bash
ollama pull llama3.2:3b          # fast
ollama pull qwen2.5-coder:14b    # standard
ollama pull deepseek-r1:14b      # reasoning
ollama pull qwen2.5-coder:32b    # powerful
```

3. Set environment variables:
```bash
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434/api  # optional, this is the default

# Optional: customize model selection
OLLAMA_FAST_MODEL=llama3.2:3b
OLLAMA_STANDARD_MODEL=qwen2.5-coder:14b
OLLAMA_REASONING_MODEL=deepseek-r1:14b
OLLAMA_POWERFUL_MODEL=qwen2.5-coder:32b
```

4. The `src/agents.ts` file already includes Ollama support:
```typescript
import { createOllama } from 'ollama-ai-provider-v2';

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

export const models = {
  fast: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_FAST_MODEL || 'llama3.2:3b');
    }
    return createOpenRouter().chat(process.env.MODEL || 'qwen/qwen3-coder:free');
  },
  standard: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_STANDARD_MODEL || 'qwen2.5-coder:14b');
    }
    return createOpenRouter().chat(process.env.MODEL || 'qwen/qwen3-coder:free');
  },
  reasoning: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_REASONING_MODEL || 'deepseek-r1:14b');
    }
    return createOpenRouter().chat('deepseek/deepseek-chat-v3:free');
  },
  powerful: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama(process.env.OLLAMA_POWERFUL_MODEL || 'qwen2.5-coder:32b');
    }
    return createOpenRouter().chat('anthropic/claude-sonnet-4.5');
  },
};
```

## Expansion: Multi-Agent Orchestration

Split work across specialized agents (planner → implementer → evaluator).

**Implementation:**

1. Create specialized agents in `src/main.ts`:

```typescript
const plannerAgent = createAgentWithRole('planner', {
  search_codebase: codebaseTools.search_codebase,
  grep_codebase: codebaseTools.grep_codebase,
  sequential_thinking: sequentialThinkingTools,
  plan_tool: planTool,
}, { modelType: 'fast' });

const implementerAgent = createAgentWithRole('implementer', {
  ...filesystemTools,
  ...gitTools,
  plan_tool: planTool,
  validation_tool: validationTool,
}, { modelType: 'standard' });

const evaluatorAgent = createAgentWithRole('evaluator', {
  validation_tool: validationTool,
  search_codebase: codebaseTools.search_codebase,
  grep_codebase: codebaseTools.grep_codebase,
}, { modelType: 'reasoning' });
```

2. Create orchestration function:

```typescript
async function orchestratedDevelopment(userRequest: string) {
  const plan = await plannerAgent.generate({ prompt: userRequest });

  const implementation = await implementerAgent.generate({
    prompt: `Execute this plan:\n${plan.text}`
  });

  const evaluation = await evaluatorAgent.generate({
    prompt: `Review this implementation:\n${implementation.text}`
  });

  const qualityScore = extractQualityScore(evaluation.text);

  if (qualityScore < 8) {
    console.log('Quality below threshold, retrying with feedback...');
    return orchestratedDevelopment(
      `${userRequest}\n\nPrevious attempt feedback:\n${evaluation.text}`
    );
  }

  return implementation;
}
```

3. Use in main:
```typescript
const result = await orchestratedDevelopment(
  'Add markdown export feature with tests'
);
```

**Agent roles in `src/agents.ts`:**
- `generic` - Current all-purpose agent
- `planner` - Creates implementation plans
- `implementer` - Executes code changes
- `evaluator` - Validates quality

## Expansion: Context Summarization

Replace context trimming with intelligent summarization.

**Implementation:**

1. Create summarizer agent:

```typescript
const summarizerAgent = createAgentWithRole('generic', {}, {
  modelType: 'fast',
  stopWhen: stepCountIs(1),
});

const prepareStep: PrepareStepFunction<typeof tools> = async ({ messages }) => {
  const TOKEN_LIMIT = 150000;

  if (estimateTokens(messages) > TOKEN_LIMIT) {
    console.log('🧠 Generating context summary...');

    const toSummarize = messages.slice(1, -15);
    const recent = messages.slice(-15);

    const summary = await summarizerAgent.generate({
      prompt: `Summarize this conversation preserving:
- Task objectives
- Code changes made
- Current progress
- Key decisions

Conversation: ${JSON.stringify(toSummarize)}`
    });

    return {
      messages: [
        messages[0],
        { role: 'system', content: `Previous context: ${summary.text}` },
        ...recent,
      ],
    };
  }

  return { messages };
};
```

This enables much longer conversations without losing context.

## Expansion: Parallel Processing

Execute independent tasks simultaneously.

**Implementation:**

```typescript
async function parallelAnalysis(files: string[]) {
  const analyzerAgent = createAgentWithRole('evaluator', {
    search_codebase,
    validation_tool
  });

  const analyses = await Promise.all(
    files.map(file =>
      analyzerAgent.generate({
        prompt: `Analyze ${file} for code quality issues`
      })
    )
  );

  return aggregateResults(analyses);
}
```

## Tool Groups

Pre-configured tool sets for specialized agents in `src/agent-tools.ts`:

```typescript
export const toolGroups = {
  planning: { plan_tool },
  implementation: { plan_tool, validation_tool },
  evaluation: { validation_tool },
  all: { plan_tool, validation_tool },
};
```

Add tools to groups as needed when creating specialized agents.
