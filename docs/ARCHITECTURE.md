# Agent Architecture

## Current Implementation

Single file (`src/main.ts`) with environment-controlled behavior:

**Approval Modes:**
- `APPROVAL_MODE=auto` - Auto-approves `ask_user` tool calls
- `APPROVAL_MODE=manual` - Waits for user input

**Run Modes:**
- `RUN_MODE=once` - Single execution
- `RUN_MODE=loop` - Conversation loop

```bash
pnpm run dev   # APPROVAL_MODE=auto RUN_MODE=once
pnpm run chat  # APPROVAL_MODE=manual RUN_MODE=loop
```

## File Structure

```
src/
├── main.ts            # Entry point, mode routing
├── agents.ts          # Agent factory, model configs, role prompts
├── agent-tools.ts     # plan_tool, validation_tool, tool groups
├── prompts.ts         # System prompt
├── tools.ts           # MCP tool mapping
├── rag.ts             # Semantic search
├── grep.ts            # Pattern matching
├── mcp-client.ts      # MCP protocol client
├── chunking.ts        # Code chunking
└── cache.ts           # Embedding cache
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

1. Set environment variable:
```bash
OLLAMA_ENABLED=true
```

2. Pull models:
```bash
ollama pull llama3.2:3b        # fast
ollama pull qwen2.5-coder:14b  # standard
ollama pull deepseek-r1:14b    # reasoning
```

3. Update `src/agents.ts` model functions to use Ollama provider:
```typescript
import { createOllama } from 'ollama-ai-provider';

const ollama = createOllama();

export const models = {
  fast: () => {
    if (process.env.OLLAMA_ENABLED === 'true') {
      return ollama('llama3.2:3b');
    }
    return createOpenRouter().chat('qwen/qwen3-coder:free');
  },
  // ... similar for other models
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
