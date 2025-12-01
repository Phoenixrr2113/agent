# Tool Context Management Research

## Executive Summary

This document provides comprehensive research on how the AI SDK manages tools in the context window, how to manipulate tool availability per step, and the implications for building efficient tool activation/deactivation systems.

**Key Finding:** Tool schemas are NOT stored in message history. They are sent as separate parameters per API call. The `activeTools` parameter in `prepareStep` allows dynamic control of which tool schemas are sent to the model on each step, effectively removing inactive tools from the context window.

---

## Table of Contents

1. [How Tool Context Works](#how-tool-context-works)
2. [Message Structure](#message-structure)
3. [The prepareStep Callback](#the-preparestep-callback)
4. [activeTools Parameter](#activetools-parameter)
5. [Context Window Implications](#context-window-implications)
6. [Known Issues](#known-issues)
7. [Implementation Strategy](#implementation-strategy)
8. [References](#references)

---

## How Tool Context Works

### Tool Schemas vs Message History

The AI SDK maintains a clear separation between:

1. **Tool Definitions (Schemas)** - Sent as configuration parameters to the model
2. **Tool Execution Records** - Stored in conversation message history

```typescript
// Tool schemas sent separately
const result = await generateText({
  model: openai('gpt-4o'),
  messages: conversationHistory,    // ← Message history
  tools: {                           // ← Tool schemas (separate)
    weather: weatherTool,
    calculator: calculatorTool,
  },
});
```

**Critical Insight:** Tool definitions are not part of the message array. They are passed as a distinct parameter on each API call. This means:
- Tool schemas can be changed between steps without modifying message history
- Only tool calls and results are stored in messages, not schemas
- The model receives fresh tool definitions on each step

### What's in the Context Window

On each generation step, the model receives:

1. **System prompt** (if provided)
2. **Message history** containing:
   - User messages
   - Assistant text responses
   - Tool calls (type, name, arguments)
   - Tool results (output, errors)
3. **Available tool schemas** (passed via `tools` parameter)

---

## Message Structure

### Message Types

```typescript
type ModelMessage =
  | SystemModelMessage
  | UserModelMessage
  | AssistantModelMessage
  | ToolModelMessage;
```

### Assistant Messages with Tool Calls

```typescript
type AssistantModelMessage = {
  role: 'assistant';
  content: string | Array<TextPart | ToolCallPart>;
};

interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;      // Only the name, NOT the schema
  args: unknown;         // Arguments passed to the tool
}
```

**Note:** Only the tool name and arguments are stored, not the full tool definition with description and schema.

### Tool Result Messages

```typescript
type ToolModelMessage = {
  role: 'tool';
  content: Array<ToolResultPart>;
};

interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: LanguageModelV2ToolResultOutput;
}
```

### Example Message Flow

```typescript
[
  { role: 'user', content: 'What is the weather in SF?' },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'call_123',
        toolName: 'weather',
        args: { location: 'San Francisco' }
      }
    ]
  },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'call_123',
        toolName: 'weather',
        result: { temperature: 65, conditions: 'sunny' }
      }
    ]
  },
  { role: 'assistant', content: 'The weather in SF is 65°F and sunny.' }
]
```

**Key Observation:** Message history grows with tool call records, but tool schemas are sent separately on each step.

---

## The prepareStep Callback

### Overview

`prepareStep` is called before each step in the agent loop, allowing dynamic modification of:
- Model selection
- Tool availability
- Tool choice forcing
- Message history (for compression)
- Any other step-specific configuration

### Function Signature

```typescript
prepareStep: async ({
  model,      // Current model configuration
  stepNumber, // 0-indexed step number
  steps,      // All previous steps with results
  messages    // Messages to be sent to the model
}) => {
  // Return object with modifications
  return {
    model?: LanguageModelV1,
    toolChoice?: ToolChoice,
    activeTools?: string[],
    messages?: ModelMessage[],
  };
}
```

### Example: Context Compression

```typescript
prepareStep: async ({ messages }) => {
  const MAX_CONTEXT_MESSAGES = 50;

  if (messages.length > MAX_CONTEXT_MESSAGES) {
    return {
      messages: [
        messages[0],  // Keep system message
        ...messages.slice(-(MAX_CONTEXT_MESSAGES - 1)),
      ],
    };
  }

  return { messages };
}
```

This is exactly what our current implementation does (`packages/core/src/application/orchestrator.ts:5-21`).

---

## activeTools Parameter

### Purpose

The `activeTools` parameter allows limiting which tools are available to the model for a specific step, even when many tools are defined in the agent configuration.

### Usage

```typescript
prepareStep: async ({ stepNumber }) => {
  if (stepNumber === 0) {
    return {
      activeTools: ['search_tools', 'shell'],  // Only these tools available
    };
  }

  if (stepNumber >= 1) {
    return {
      activeTools: ['github_pr', 'web_search'],  // Different tools for later steps
    };
  }

  return {};  // Default: all tools available
}
```

### How It Works

1. Agent is initialized with ALL tools:
   ```typescript
   const agent = new Agent({
     tools: {
       tool1: tool1Def,
       tool2: tool2Def,
       tool3: tool3Def,
       // ... 40+ tools
     }
   });
   ```

2. On each step, `prepareStep` filters which tools are sent:
   ```typescript
   // Step 1: Only tool1 schema sent to model
   // Step 2: Only tool2 and tool3 schemas sent to model
   // Step 3: All tools sent to model (if activeTools undefined)
   ```

3. **Tool schemas are removed from context** when not in `activeTools`

### Benefits

- **Reduces context consumption:** 40 tools × 100 tokens/tool = 4,000 tokens saved when most are inactive
- **Focuses model attention:** Model only sees relevant tools for current phase
- **Enables phased workflows:** Different tool sets for search → analysis → action phases
- **Maintains type safety:** All tools defined at agent creation, filtered at runtime

### Example: Three-Phase Workflow

```typescript
const agent = new Agent({
  model: 'anthropic/claude-sonnet-4.5',
  tools: {
    search: searchTool,
    analyze: analyzeTool,
    summarize: summarizeTool,
  },
  prepareStep: async ({ stepNumber }) => {
    // Search phase
    if (stepNumber < 3) {
      return {
        activeTools: ['search'],
        toolChoice: 'required',
      };
    }

    // Analysis phase
    if (stepNumber < 6) {
      return {
        activeTools: ['analyze'],
      };
    }

    // Summary phase
    return {
      activeTools: ['summarize'],
      toolChoice: { type: 'tool', toolName: 'summarize' },
    };
  },
});
```

---

## Context Window Implications

### Token Consumption Breakdown

For a typical tool with description, parameters, and examples:

```typescript
// Example tool definition
tool({
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Max results'),
  }),
})
```

**Estimated tokens:**
- Tool name: 5 tokens
- Description: 10 tokens
- Schema definition: 50-100 tokens
- Parameter descriptions: 30-50 tokens
- **Total: ~100-150 tokens per tool**

### Scaling Impact

| Number of Tools | Tokens per Step | Impact |
|----------------|-----------------|---------|
| 5 tools | 500-750 tokens | Negligible |
| 20 tools | 2,000-3,000 tokens | Moderate |
| 40 tools | 4,000-6,000 tokens | Significant |
| 100 tools | 10,000-15,000 tokens | Critical |

With 40+ activated tools, tool schemas alone consume 20-30% of a typical 32K context window.

### Message History Growth

Message history grows linearly with tool usage:

```
Initial: User message (50 tokens)
Step 1: + Assistant tool call (100 tokens)
Step 2: + Tool result (200 tokens)
Step 3: + Assistant tool call (100 tokens)
Step 4: + Tool result (150 tokens)
...
```

**Key Insight:** While message history grows with tool execution records, tool schemas can be dynamically controlled per step.

---

## Known Issues

### activeTools Execution Bug

**Issue:** [vercel/ai#8653](https://github.com/vercel/ai/issues/8653)

**Problem:** The `activeTools` parameter correctly filters which tool schemas are sent to the model, but the SDK still executes tool calls for inactive tools if the model generates them (possibly from memory of previous steps).

**Expected Behavior:**
- Model receives schemas only for active tools
- Model can only call active tools
- Inactive tools cannot be executed

**Actual Behavior:**
- Model receives schemas only for active tools ✓
- Model can generate calls to inactive tools (from memory)
- SDK executes these calls against full tool set ✗

**Root Cause:**
```typescript
// SDK correctly filters tools for model
const stepTools = filterActiveTools(tools, activeTools);

// But execution uses unfiltered tools
runToolsTransformation(tools, toolCalls);  // Should use stepTools
```

**Impact on Our Use Case:**
- **Context reduction still works** - inactive tool schemas are not sent to model
- **Execution bug exists** - but doesn't affect context window size
- **Workaround:** Our tool wrapper approach catches unauthorized calls

**Mitigation Strategy:**
Our existing `ToolActivationManager` wrapper already prevents execution of inactive tools by checking `isActive()` before calling the original tool's `execute` function. This serves as a safety layer regardless of the SDK bug.

---

## Implementation Strategy

### Current Architecture

Our codebase uses:
- `ToolLoopAgent` (AI SDK 5 Agent class)
- `prepareStep` for message compression (orchestrator.ts:5-21)
- All tools passed at agent initialization
- Tool wrapper pattern for activation checking

### Recommended Approach

**Integrate `activeTools` into existing `prepareStep`:**

```typescript
export function createPrepareStep(activationManager: ToolActivationManager): PrepareStepFunction<any> {
  return ({ messages, stepNumber }) => {
    const MAX_CONTEXT_MESSAGES = 50;

    // Message compression
    let finalMessages = messages;
    if (messages.length > MAX_CONTEXT_MESSAGES) {
      finalMessages = [
        messages[0],
        ...messages.slice(-(MAX_CONTEXT_MESSAGES - 1)),
      ];
    }

    // Dynamic tool filtering based on activation state
    const activeToolNames = activationManager.getActiveToolNames();
    const coreTools = ['shell', 'plan', 'ask_user', 'task_complete',
                       'search_tools', 'activate_tool', 'deactivate_tool'];

    return {
      messages: finalMessages,
      activeTools: [...coreTools, ...activeToolNames],
    };
  };
}
```

### Integration Points

1. **orchestrator.ts** - Modify `createPrepareStep()` to accept `activationManager`
2. **agent-runtime.ts** - Pass `activationManager` from initialization to orchestrator
3. **initialization.ts** - Export `activationManager` alongside tools

### Benefits

- **Automatic context optimization** - Inactive tool schemas removed from each step
- **No manual intervention** - Works automatically with activate/deactivate tools
- **Significant token savings** - With 40 tools, save ~4,000 tokens per step when most are inactive
- **Maintains existing architecture** - Minimal changes to current codebase

### Example Flow

```typescript
// User activates web_search
activate_tool({ toolName: 'web_search' });

// Next step's prepareStep returns:
{
  activeTools: [
    'shell', 'plan', 'ask_user', 'task_complete',
    'search_tools', 'activate_tool', 'deactivate_tool',
    'web_search'  // ← Only activated deferred tool
  ]
}

// Model receives:
// - Schemas for 8 tools (not 48 tools)
// - Saves ~4,000 tokens in context window
```

---

## References

### Official Documentation

- [AI SDK Core: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Agents: Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [AI SDK Core: ModelMessage](https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message)
- [AI SDK Core: streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)

### GitHub Issues

- [activeTools filtering allows execution of tool calls not in active tools list #8653](https://github.com/vercel/ai/issues/8653)
- [Dynamic tool support for Agent Swarm architecture in prepareStep #7787](https://github.com/vercel/ai/issues/7787)

### Related Discussions

- [Guidance on persisting messages #4845](https://github.com/vercel/ai/discussions/4845)

### Codebase Files

- `/home/user/agent/packages/core/src/application/orchestrator.ts` - Current prepareStep implementation
- `/home/user/agent/packages/core/src/runtime/agent-runtime.ts` - Agent runtime and message management
- `/home/user/agent/packages/core/src/core/agents/factory.ts` - Agent creation with ToolLoopAgent
- `/home/user/agent/packages/core/src/tools/tool-wrapper.ts` - ToolActivationManager implementation

---

## Conclusion

The AI SDK provides robust support for dynamic tool context management through the `activeTools` parameter in `prepareStep`. Tool schemas are sent per-step as configuration parameters, NOT stored in message history. This enables:

1. **True context window reduction** - Inactive tool schemas are completely removed
2. **Dynamic tool management** - Different tools available at different phases
3. **Efficient token usage** - Save thousands of tokens with many tools

Our existing activation system can be enhanced by integrating `activeTools` into the `prepareStep` callback, providing automatic context optimization based on tool activation state.

The known execution bug (issue #8653) does not affect context window management and is already mitigated by our tool wrapper pattern.
