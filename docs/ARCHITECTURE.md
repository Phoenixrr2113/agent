# Future-Proof Agent Architecture

## Overview

This agent is built with a modular architecture that supports future expansion without refactoring. You can use it simply NOW, and add advanced features LATER with minimal code changes.

## Single Unified File

**One file, multiple modes** (`src/agent.ts`)

The agent has two environment-controlled behaviors:

**Approval Mode:**
- `APPROVAL_MODE=auto` - Agent auto-approves all `ask_user` calls (autonomous)
- `APPROVAL_MODE=manual` - Agent waits for user input (interactive)

**Run Mode:**
- `RUN_MODE=once` - Runs once then exits
- `RUN_MODE=loop` - Runs in conversation loop

```bash
# Autonomous mode (auto-approve, run once)
pnpm run dev

# Interactive mode (manual approval, conversation loop)
pnpm run chat
```

## Future State (Zero Refactoring Required)

### 1. Model Routing

**Enable different models for different tasks:**

```typescript
// In src/index.ts, uncomment these lines in prepareStep:
const prepareStep: PrepareStepFunction<typeof tools> = ({ messages, step }) => {
  const lastMessage = messages[messages.length - 1];
  const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

  if (content.includes('complex') || content.includes('debug')) {
    return { messages, model: models.reasoning() };
  }
  if (content.includes('simple') || content.includes('quick')) {
    return { messages, model: models.fast() };
  }

  return { messages };
};
```

### 2. Ollama Support

**Switch to local models:**

```bash
# In .env
OLLAMA_ENABLED=true
```

Models automatically switch to Ollama when enabled (see `src/agents.ts`):
- Fast: llama3.2:3b
- Standard: qwen2.5-coder:14b
- Reasoning: deepseek-r1:14b

### 3. Multi-Agent Orchestration

**Uncomment 3 lines in src/index.ts:**

```typescript
// Already written, just uncomment:
const plannerAgent = createAgentWithRole('planner', planningTools, { modelType: 'fast' });
const implementerAgent = createAgentWithRole('implementer', implementationTools);
const evaluatorAgent = createAgentWithRole('evaluator', evaluationTools, { modelType: 'reasoning' });

// Then use orchestrated workflow:
async function developFeature(userRequest: string) {
  // 1. Planner creates plan
  const plan = await plannerAgent.generate({ prompt: userRequest });

  // 2. Implementer executes
  const implementation = await implementerAgent.generate({
    prompt: `Execute: ${plan.text}`
  });

  // 3. Evaluator validates
  const evaluation = await evaluatorAgent.generate({
    prompt: `Review: ${implementation.text}`
  });

  // 4. Retry if quality low
  if (extractQuality(evaluation.text) < 8) {
    // Retry with feedback
  }

  return implementation;
}
```

## New Tools

### Plan Tracking

```typescript
// Create a plan
plan_tool({
  action: 'create',
  title: 'Add export feature',
  steps: ['Search patterns', 'Implement function', 'Add tests', 'Document']
});

// Update progress
plan_tool({
  action: 'update_status',
  stepName: 'Implement function',
  status: 'completed'
});

// View progress
plan_tool({ action: 'view' });
```

### Code Validation

```typescript
// Check types after changes
validation_tool({
  checkTypes: true,
  runTests: false,
  filesChanged: ['src/export.ts']
});

// Run full validation
validation_tool({
  checkTypes: true,
  runTests: true
});
```

## Agent Roles

All roles are pre-configured in `src/agents.ts`:

### Generic (Current)
- All-purpose development agent
- Has access to all tools
- Uses standard model

### Planner (Future)
- Creates implementation plans
- Fast model (cheap, quick)
- Tools: search_codebase, grep_codebase, sequential_thinking, plan_tool

### Implementer (Future)
- Executes code changes
- Standard model (balanced)
- Tools: filesystem, git, plan_tool, validation_tool

### Evaluator (Future)
- Validates code quality
- Reasoning model (thorough)
- Tools: validation_tool, search_codebase, grep_codebase

## Model Configuration

All in `src/agents.ts`:

```typescript
export const models = {
  fast: () => {...},      // Quick tasks, planning
  standard: () => {...},  // Most development
  reasoning: () => {...}, // Complex debugging
  powerful: () => {...},  // Critical tasks (Claude Sonnet)
};
```

## Tool Groups

Modular tool organization in `src/agent-tools.ts`:

```typescript
export const toolGroups = {
  planning: { plan_tool, search_codebase, grep_codebase, sequential_thinking },
  implementation: { plan_tool, validation_tool, filesystem, git },
  evaluation: { validation_tool, search_codebase, grep_codebase },
  all: { /* everything */ },
};
```

## Workflow: Today vs Tomorrow

### Today (Simple)
1. User gives task
2. Generic agent executes
3. Done

### Tomorrow (Orchestrated)
1. User gives task
2. Planner agent creates plan (fast model)
3. Implementer agent executes plan (standard model)
4. Evaluator agent validates (reasoning model)
5. Retry if quality < threshold
6. Done

**The code for "tomorrow" is already written - just uncomment it!**

## Benefits of This Architecture

1. **No Refactoring**: Future features just uncomment existing code
2. **Model Flexibility**: Easily switch between OpenRouter, Ollama, or custom providers
3. **Specialized Agents**: Different agents with different capabilities
4. **Tool Modularity**: Easy to give agents specific tool subsets
5. **System Prompt Library**: Pre-written prompts for each role

## File Structure

```
src/
├── agent.ts           # Main entry point (autonomous + interactive modes)
├── agents.ts          # Agent factory, models, system prompts
├── agent-tools.ts     # Plan tracking, validation, tool groups
├── prompts.ts         # System prompts
├── tools.ts           # MCP tool mapping
├── rag.ts             # Codebase search
└── ...
```

## Next Steps

### Immediate (Already Working)
- ✅ Plan tracking tool
- ✅ Validation tool
- ✅ Agent factory
- ✅ Model configuration

### Enable When Ready (5 minutes each)
- 🔜 Model routing (uncomment in prepareStep)
- 🔜 Ollama support (set OLLAMA_ENABLED=true)
- 🔜 Multi-agent orchestration (uncomment 3 lines)
- 🔜 Context summarization (implement summarizer agent)

### Future Enhancements
- Parallel processing for independent tasks
- Workflow templates (sequential, routing, evaluator-optimizer)
- Custom agent roles beyond the 4 built-in ones

All the infrastructure is in place. Just flip the switches when you're ready!
