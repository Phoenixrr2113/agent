# Building Smarter AI Agents: Tool Lifecycle Hooks and Adaptive Chaining

*A practical guide to designing tools that make AI agents more reliable, efficient, and self-correcting.*

---

## The Problem with Simple Tools

Most AI agent tools follow a basic pattern:

```typescript
const readFile = tool({
  description: "Read a file",
  execute: async ({ path }) => {
    return fs.readFile(path, 'utf-8');
  }
});
```

Input goes in, output comes out. Simple.

But in the real world, this breaks down:
- What if the file doesn't exist?
- What if the path is outside the allowed directory?
- What if the file is 10MB and will blow out the context window?
- What if the encoding is wrong?

The agent is left to handle all these edge cases—but models aren't great at anticipating problems they haven't encountered. They're good at reacting to errors, but by then the damage is often done.

**What if the tools were smarter?**

---

## Part 1: Tool Lifecycle Hooks

Instead of treating tools as black boxes, we can add hooks at critical moments:

```
Input → [Before] → [Validate] → [Execute] → [After] → Output
              ↓          ↓           ↓
         [Pre-process] [Guard]   [On Error]
```

### The Pattern

```typescript
interface ToolLifecycle<TInput, TOutput> {
  beforeExecute?: (input: TInput) => Promise<TInput>;
  validate?: (input: TInput) => Promise<{ valid: boolean; error?: string }>;
  execute: (input: TInput) => Promise<TOutput>;
  afterExecute?: (input: TInput, output: TOutput) => Promise<TOutput>;
  onError?: (error: Error, input: TInput) => Promise<TOutput | 'throw'>;
  cleanup?: (input: TInput, didSucceed: boolean) => Promise<void>;
}
```

Each hook serves a purpose:

| Hook | When | Purpose |
|------|------|---------|
| `beforeExecute` | Before anything | Transform input, create prerequisites |
| `validate` | After preprocessing | Reject bad inputs before they cause damage |
| `execute` | Main logic | The actual tool functionality |
| `afterExecute` | After success | Transform output, trigger side effects |
| `onError` | On failure | Recover, retry, or provide fallback |
| `cleanup` | Always | Release resources, regardless of success |

### Real Examples

#### File Write with Auto-Recovery

```typescript
const writeFile: ToolLifecycle<WriteInput, WriteOutput> = {
  beforeExecute: async (input) => {
    // Auto-create parent directories
    await mkdir(dirname(input.path), { recursive: true });
    return input;
  },
  
  validate: async (input) => {
    // Prevent writes outside workspace
    if (!input.path.startsWith(workspaceRoot)) {
      return { valid: false, error: 'Path outside allowed directory' };
    }
    // Warn about overwrites
    if (await exists(input.path) && !input.overwrite) {
      return { valid: false, error: 'File exists. Set overwrite: true' };
    }
    return { valid: true };
  },
  
  execute: async (input) => {
    await fs.writeFile(input.path, input.content);
    return { success: true, bytesWritten: input.content.length };
  },
  
  afterExecute: async (input, output) => {
    // Auto-format code files
    if (input.path.match(/\.(ts|js|json)$/)) {
      await formatWithPrettier(input.path);
    }
    return output;
  },
  
  onError: async (error, input) => {
    // If directory missing, create and retry
    if (error.code === 'ENOENT') {
      await mkdir(dirname(input.path), { recursive: true });
      await fs.writeFile(input.path, input.content);
      return { success: true, bytesWritten: input.content.length, recovered: true };
    }
    return 'throw'; // Re-throw unknown errors
  },
};
```

#### Shell Command with Safety Rails

```typescript
const shell: ToolLifecycle<ShellInput, ShellOutput> = {
  validate: async (input) => {
    // Block dangerous commands
    const dangerous = ['rm -rf /', 'mkfs', ':(){:|:&};:'];
    if (dangerous.some(d => input.command.includes(d))) {
      return { valid: false, error: 'Command blocked for safety' };
    }
    return { valid: true };
  },
  
  execute: async (input) => {
    const result = await exec(input.command, { 
      timeout: input.timeout || 30000 
    });
    return { stdout: result.stdout, stderr: result.stderr };
  },
  
  afterExecute: async (input, output) => {
    // Truncate massive outputs
    const maxLength = 10000;
    if (output.stdout.length > maxLength) {
      return {
        ...output,
        stdout: output.stdout.slice(0, maxLength) + '\n[truncated]',
        truncated: true,
      };
    }
    return output;
  },
  
  onError: async (error, input) => {
    if (error.message.includes('TIMEOUT')) {
      return { 
        stdout: '', 
        stderr: `Command timed out after ${input.timeout}ms`,
        timedOut: true,
      };
    }
    return 'throw';
  },
};
```

### Making It Opt-In

Not every tool needs every hook. Make the lifecycle wrapper flexible:

```typescript
function withLifecycle<T, R>(
  tool: Tool<T, R>,
  hooks: Partial<ToolLifecycle<T, R>>
): Tool<T, R> {
  return {
    ...tool,
    execute: async (input) => {
      let processed = input;
      
      // Before
      if (hooks.beforeExecute) {
        processed = await hooks.beforeExecute(input);
      }
      
      // Validate
      if (hooks.validate) {
        const result = await hooks.validate(processed);
        if (!result.valid) {
          throw new Error(result.error);
        }
      }
      
      try {
        // Execute
        let output = await tool.execute(processed);
        
        // After
        if (hooks.afterExecute) {
          output = await hooks.afterExecute(processed, output);
        }
        
        // Cleanup (success)
        if (hooks.cleanup) {
          await hooks.cleanup(processed, true);
        }
        
        return output;
        
      } catch (error) {
        // Error handling
        if (hooks.onError) {
          const result = await hooks.onError(error as Error, processed);
          if (result !== 'throw') return result;
        }
        
        // Cleanup (failure)
        if (hooks.cleanup) {
          await hooks.cleanup(processed, false);
        }
        
        throw error;
      }
    },
  };
}
```

---

## Part 2: Tool Chaining

When agents execute complex tasks, they typically:

1. Call tool A, wait for result
2. LLM processes result, decides next step
3. Call tool B, wait for result
4. LLM processes result, decides next step
5. ...repeat...

Each step involves an LLM inference—expensive in time and cost.

### The Insight

Many tool sequences are **predictable**. If you're:
- Reading a file to understand it, then searching for related files
- Creating a directory, then writing multiple files into it
- Running tests, then reading the failure output

...the steps don't require LLM reasoning between each one. They're a **chain**.

### The Pattern: Plan → Wait → Execute

Instead of the agent calling each tool individually, it:
1. **Plans** the sequence of tools upfront
2. **Waits** while the system executes them
3. **Reviews** the results and decides the next action

```
Agent: "I need to set up a new module. This will require:
        1. Create directory
        2. Write package.json
        3. Write index.ts
        4. Run npm install
        Let me chain these."

Agent calls: plan_chain([...steps])
Agent calls: await_chain(chainId)
        ← System executes 1, 2, 3, 4
        ← Returns all results or stops on error
Agent: "All steps completed. Now I'll..."
```

### Chain Definition

```typescript
interface ChainStep {
  id: string;                    // Unique identifier
  tool: string;                  // Tool to execute
  args: Record<string, unknown>; // Arguments for the tool
  dependsOn?: string[];          // IDs of steps whose output this needs
  onError?: 'retry' | 'skip' | 'abort';
  maxRetries?: number;
}

interface Chain {
  id: string;
  goal: string;                  // What this chain accomplishes
  steps: ChainStep[];
  status: 'ready' | 'running' | 'complete' | 'error';
}
```

### Dependency Resolution

Steps can reference outputs from previous steps:

```typescript
const chain = {
  goal: "Set up testing",
  steps: [
    { id: 'read', tool: 'read_file', args: { path: 'package.json' } },
    { 
      id: 'install', 
      tool: 'shell', 
      args: { command: 'npm install jest' },
      dependsOn: ['read']  // Wait for read to complete
    },
    { 
      id: 'config', 
      tool: 'write_file', 
      args: { 
        path: 'jest.config.js',
        // Could reference: ${steps.read.output.content}
      },
      dependsOn: ['install']
    },
  ]
};
```

The executor resolves dependencies:

```typescript
async function executeChain(chain: Chain): Promise<ChainResult> {
  const results = new Map<string, unknown>();
  
  for (const step of chain.steps) {
    // Resolve dependencies
    const resolvedArgs = resolvePlaceholders(step.args, results);
    
    try {
      const output = await executeTool(step.tool, resolvedArgs);
      results.set(step.id, output);
      
    } catch (error) {
      return {
        status: 'error',
        completedSteps: [...results.entries()],
        failedStep: { id: step.id, error: error.message },
        remainingSteps: getRemainingSteps(chain, step.id),
      };
    }
  }
  
  return { status: 'complete', results: [...results.entries()] };
}
```

### Error Handling Strategies

When a step fails, the agent gets rich information:

```typescript
{
  status: "error",
  completedSteps: [
    { id: "mkdir", result: { success: true } },
    { id: "write_package", result: { bytesWritten: 245 } }
  ],
  failedStep: { 
    id: "npm_install",
    error: "npm ERR! network timeout" 
  },
  remainingSteps: ["write_index", "run_tests"]
}
```

The agent can then:
- **Retry**: Re-run the chain from the failed step
- **Skip**: Continue with remaining steps
- **Abort**: Cancel the rest entirely
- **Manual**: Switch to step-by-step execution

### Parallel Execution

Independent steps can run in parallel:

```typescript
const chain = {
  steps: [
    { id: 'a', tool: 'web_search', args: { query: 'topic 1' } },
    { id: 'b', tool: 'web_search', args: { query: 'topic 2' } },
    { id: 'c', tool: 'web_search', args: { query: 'topic 3' } },
    { id: 'combine', tool: 'summarize', dependsOn: ['a', 'b', 'c'] }
  ]
};
// a, b, c execute in parallel; combine waits for all three
```

---

## Part 4: Delegated Execution (The Team Lead Pattern)

Tool chaining solves the efficiency problem. But what about the intelligence problem?

When `await_chain` encounters an error, it stops and returns. The calling agent then has to reason about what went wrong. But by that point, the context has shifted—the agent may have forgotten details or lost momentum.

### The Insight: Delegate to a Sub-Agent

Think of how effective engineering teams work:

- **Team Lead**: Researches the problem, creates a plan, assigns to developer
- **Developer**: Owns the task from start to finish, handles issues, reports back
- **Team Lead**: Reviews outcome, decides next steps

The same pattern works for agents:

```
Main Agent (Team Lead)
  │
  ├─ Researches problem
  ├─ Creates plan
  ├─ delegate_chain(goal, steps)
  │
  └────────────────────────────────▶ Sub-Agent (Developer)
                                          │
                                          ├─ plan_chain(steps)
                                          ├─ await_chain(chainId)
                                          │     ↓
                                          │   Step 1 ✓
                                          │   Step 2 ✓
                                          │   Step 3 ✗ Error!
                                          │     ↓
                                          ├─ Reasons about error
                                          ├─ Retries with modification
                                          ├─ Continues to completion
                                          │
  ◀──────────────────────────────────────────┘
  │
  └─ Reviews summary, continues
```

### Why This Works

The sub-agent has:
- **Fresh context**: Only the goal and steps, no accumulated history noise
- **Clear ownership**: It's responsible for completing this chain
- **Authority to adapt**: Can modify approach based on what it observes
- **Focused reasoning**: All its thinking is about this one task

### The Layered Architecture

```
┌─────────────────────────────────────────────┐
│ Main Agent                                  │
│   - High-level planning and coordination    │
│   - Delegates complex work                  │
└─────────────────┬───────────────────────────┘
                  │ delegate_chain
                  ▼
┌─────────────────────────────────────────────┐
│ Sub-Agent (Worker)                          │
│   - Owns execution from start to finish     │
│   - Handles errors intelligently            │
│   - Uses plan_chain + await_chain           │
└─────────────────┬───────────────────────────┘
                  │ await_chain
                  ▼
┌─────────────────────────────────────────────┐
│ Chain Executor                              │
│   - Runs steps sequentially/parallel        │
│   - Streams status to sub-agent             │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ Tools + Lifecycle Hooks                     │
│   - Individual tool execution               │
│   - Validation, recovery, cleanup           │
└─────────────────────────────────────────────┘
```

### When to Delegate vs. Execute Directly

| Scenario | Approach |
|----------|----------|
| Simple, predictable chain | `await_chain` directly |
| Complex chain with likely errors | `delegate_chain` to sub-agent |
| Exploratory/uncertain task | Sub-agent with broad authority |
| Parallel independent chains | Multiple sub-agents |

---

## Part 5: Combining Everything

The real power comes from tools with lifecycle hooks **inside** chains:

```
Chain Step 1: write_file
    └─ beforeExecute: mkdir parents
    └─ validate: check path
    └─ execute: write content
    └─ afterExecute: format code
    └─ onError: retry once
        ↓
Chain Step 2: run_tests
    └─ validate: ensure test file exists
    └─ execute: jest
    └─ afterExecute: parse coverage
    └─ onError: return partial results
        ↓
Complete → Return to agent
```

Each step is self-healing. The chain doesn't fail on the first hiccup—it exhausts recovery options first.

---

## Part 4: Why This Matters

### For Reliability

Simple tools fail in surprising ways. Lifecycles make failures predictable and recoverable. The agent doesn't see "operation failed"—it sees "permission denied, need elevated access" or "file too large, truncating to first 1000 lines."

### For Efficiency

Every LLM call costs time and money. Chains reduce a 10-step task from 10 inferences to 3:
1. Plan the chain
2. Execute and review
3. Handle any errors or continue

### For Observability

With hooks, you can log:
- What input was received
- How it was transformed
- Why it failed validation
- What recovery was attempted
- What cleanup occurred

This makes debugging agent behavior possible.

### For Safety

Validation hooks can enforce boundaries:
- Path traversal prevention
- Rate limiting
- Content filtering
- Resource caps

The agent can't bypass these—they're enforced at the tool layer.

---

## Implementation Checklist

### For Tool Lifecycles

1. **Identify failure modes** for each tool
2. **Add validation** for the most dangerous inputs
3. **Implement recovery** for common, recoverable errors
4. **Truncate/transform** outputs that could overwhelm context
5. **Add cleanup** for tools that allocate resources

### For Tool Chaining

1. **Identify common sequences** in agent behavior
2. **Define dependency graph** for steps
3. **Implement executor** with proper error handling
4. **Return rich failure info** so agent can recover
5. **Support parallel execution** for independent steps

---

## Conclusion

The difference between a prototype agent and a production agent isn't the model—it's the tools. 

Smart tools with lifecycle hooks handle edge cases before the agent even sees them. Tool chaining reduces latency and cost while maintaining agent control.

The agent's job is to reason and decide. The tools' job is to execute reliably. When you build tools that take responsibility for their own reliability, the agent can focus on what it does best.

---

*The patterns described here are framework-agnostic and can be implemented in any AI agent system—whether you're using LangChain, AutoGPT, custom implementations, or anything else.*
