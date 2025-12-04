# Tool Registration & Management Guide

This guide explains how to register tools with rich metadata to enable effective semantic search and discovery, as well as how the agent manages tool activation throughout its lifecycle.

## Basic Registration

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { createToolRegistry } from '@agent/core';

const registry = createToolRegistry();

const myTool = tool({
  description: 'Get user information by ID',
  inputSchema: z.object({
    userId: z.string().describe('The unique identifier of the user'),
    includeOrders: z.boolean().optional().describe('Whether to include order history'),
  }),
  execute: async ({ userId, includeOrders }) => {
    // Implementation
  },
});

registry.register('get_user', myTool);
```

## Enhanced Registration for Better Discovery

To enable accurate semantic search, especially when you have many similar tools, provide rich metadata:

```typescript
registry.register('get_user', myTool, {
  tags: ['user', 'fetch', 'database'],
  examples: [
    { userId: '123', includeOrders: true },
    { userId: 'abc-def', includeOrders: false },
  ],
});
```

## What Gets Embedded for Semantic Search

When `generateEmbeddings()` is called, the following information is embedded:

1. **Tool Name** - `get_user`
2. **Description** - From tool definition
3. **Tags** - `['user', 'fetch', 'database']`
4. **Parameters** - Extracted from Zod schema with descriptions
   - `userId (ZodString): The unique identifier of the user`
   - `includeOrders (ZodBoolean): Whether to include order history`
5. **Examples** - JSON stringified examples
   - `{"userId":"123","includeOrders":true}`

**Embedding Text:**
```
get_user: Get user information by ID. Tags: user, fetch, database. Parameters: userId (ZodString): The unique identifier of the user, includeOrders (ZodBoolean): Whether to include order history. Examples: {"userId":"123","includeOrders":true}; {"userId":"abc-def","includeOrders":false}
```

## Why This Matters

With 100+ similar tools, semantic search uses all this context to differentiate:

```typescript
// Without rich metadata:
get_user_by_id: "Get user by ID"
get_order_by_id: "Get order by ID"
get_product_by_id: "Get product by ID"
// ❌ Hard to differentiate semantically

// With rich metadata:
get_user_by_id: "Get user by ID. Tags: user, customer, account. Parameters: userId (string): customer identifier. Examples: {userId: 'U123'}"
get_order_by_id: "Get order by ID. Tags: order, purchase, transaction. Parameters: orderId (string): order number. Examples: {orderId: 'ORD-456'}"
get_product_by_id: "Get product by ID. Tags: product, inventory, catalog. Parameters: productId (string): SKU or product code. Examples: {productId: 'PROD-789'}"
// ✅ Clear semantic differences
```

## Best Practices

### 1. Use Descriptive Parameter Names

```typescript
// ❌ Bad
z.object({
  id: z.string(),
  flag: z.boolean(),
})

// ✅ Good
z.object({
  userId: z.string().describe('The unique identifier of the user'),
  includeDeleted: z.boolean().describe('Include soft-deleted users in results'),
})
```

### 2. Add Meaningful Tags

Tags help categorize and discover tools:

```typescript
// ❌ Generic
tags: ['api', 'data']

// ✅ Specific
tags: ['user', 'authentication', 'database', 'read-only']
```

### 3. Provide Representative Examples

Examples show typical usage patterns:

```typescript
examples: [
  // Common case
  { userId: 'U123', includeOrders: true },
  // Edge case
  { userId: 'admin', includeOrders: false },
  // Different parameter combinations
  { userId: 'guest-user' },
]
```

### 4. Write Clear Descriptions

Descriptions should explain:
- What the tool does
- When to use it
- Any important constraints

```typescript
// ❌ Vague
description: 'Gets user'

// ✅ Clear
description: 'Retrieves user profile information from the database. Use this to fetch account details, preferences, and metadata. Does not include sensitive data like passwords.'
```

## Complete Example: API Endpoint Tools

```typescript
// Define multiple similar endpoints with rich context

registry.register('get_user_profile', getUserTool, {
  tags: ['user', 'profile', 'read', 'authenticated'],
  examples: [
    { userId: 'U123' },
    { userId: 'john@example.com' },
  ],
});

registry.register('update_user_profile', updateUserTool, {
  tags: ['user', 'profile', 'write', 'authenticated'],
  examples: [
    { userId: 'U123', data: { name: 'John Doe' } },
    { userId: 'U456', data: { email: 'new@example.com', phone: '555-0100' } },
  ],
});

registry.register('delete_user_account', deleteUserTool, {
  tags: ['user', 'account', 'delete', 'admin', 'destructive'],
  examples: [
    { userId: 'U789', reason: 'user request' },
  ],
});

// Generate embeddings
await registry.generateEmbeddings();

// Now semantic search can accurately differentiate:
// "get user info" → finds get_user_profile
// "change user email" → finds update_user_profile
// "remove user" → finds delete_user_account
```

## Tool Discovery Query Examples

With rich metadata, agents can find tools using natural language:

```typescript
// Agent needs: "fetch customer details"
tool_search({ query: "fetch customer details" })
// ✅ Finds: get_user_profile (tags: user, profile, read)

// Agent needs: "modify account information"
tool_search({ query: "modify account information" })
// ✅ Finds: update_user_profile (tags: user, profile, write)

// Agent needs: "permanently remove account"
tool_search({ query: "permanently remove account" })
// ✅ Finds: delete_user_account (tags: account, delete, destructive)
```

## Tool Lifecycle & Management

### How the Agent Sees Tools

The agent receives tools in the `tools` parameter of `generateText`/`streamText`:

```typescript
const agent = new ToolLoopAgent({
  model: models.standard(),
  instructions: systemPrompt,
  tools: {
    // Active tools (always available)
    shell: shellTool,
    plan: planTool,
    tool_search: searchToolTool,
    activate_tool: activateToolTool,
    // Wrapped deferred tools (require activation)
    web_search: wrappedWebSearchTool,
    memory_search: wrappedMemorySearchTool,
    // ... etc
  },
});
```

The model sees ALL tools in the schema from the start, but deferred tools are wrapped to check activation status before execution.

### Tool Discovery Strategy

**Question: Does the agent search for tools one-at-a-time or in parallel?**

It depends on how the agent decides to plan:

**Sequential Discovery (Common):**
```typescript
// Agent realizes it needs something
1. Call tool_search({ query: "web search" })
2. See result, decide to activate
3. Call activate_tool({ toolName: "web_search" })
4. Use web_search({ query: "..." })
```

**Parallel Discovery (Possible):**
```typescript
// Agent can make multiple search calls in one step
1. Call tool_search({ query: "web search" })
   Call tool_search({ query: "code analysis" })
   Call tool_search({ query: "database query" })
2. Review all results
3. Activate needed tools in parallel
4. Use tools
```

The AI SDK Core supports multiple tool calls in a single step, so the agent CAN search and activate multiple tools at once if it plans that way.

### Tool Deactivation

**Problem:** With 40+ activated tools, the context window fills up with tool schemas.

**Solution:** Implement deactivation:

```typescript
// In ToolActivationManager
deactivate(toolName: string): boolean {
  return this.activeTools.delete(toolName);
}

// Create deactivate_tool
const deactivateTool = tool({
  description: 'Deactivate a specialized tool to free up context space',
  inputSchema: z.object({
    toolName: z.string().describe('Name of tool to deactivate'),
  }),
  execute: async ({ toolName }) => {
    const wasDeactivated = activationManager.deactivate(toolName);
    return JSON.stringify({
      success: wasDeactivated,
      message: wasDeactivated
        ? `Tool "${toolName}" deactivated`
        : `Tool "${toolName}" was not active`,
    });
  },
});
```

**Automatic Deactivation Strategies:**

1. **LRU (Least Recently Used)**: Deactivate tools not used in last N steps
2. **Time-based**: Auto-deactivate after X minutes of inactivity
3. **Count-based**: Keep only N most recent tools active
4. **Manual**: Let agent decide when to deactivate

```typescript
// Example: Auto-deactivate after 10 steps of no use
class ToolActivationManager {
  private lastUsed: Map<string, number> = new Map();
  private currentStep = 0;

  onStepFinish(toolsUsed: string[]) {
    this.currentStep++;
    toolsUsed.forEach(tool => this.lastUsed.set(tool, this.currentStep));

    // Auto-deactivate tools unused for 10 steps
    for (const [tool, lastStep] of this.lastUsed) {
      if (this.currentStep - lastStep > 10) {
        this.deactivate(tool);
        this.lastUsed.delete(tool);
      }
    }
  }
}
```

### Context Window Management

**Tool schemas consume tokens.** With many tools:

```
40 tools × ~100 tokens/schema = 4,000 tokens just for tool definitions
```

**Strategies:**

1. **Lazy Activation**: Only activate tools when needed (current system)
2. **Deactivation**: Remove unused tools from context
3. **Tool Grouping**: Group related tools, activate groups
4. **Short Descriptions**: Keep tool descriptions concise
5. **Parameter Simplification**: Use minimal parameter descriptions in schema, more detail in examples

### Where Active Tools Are Stored

**In Memory:**
```typescript
// ToolActivationManager tracks activation state
private activeTools: Set<string> = new Set();

// Tools are passed to agent at creation
const agent = new ToolLoopAgent({
  tools: { ...activeTools, ...wrappedDeferredTools }
});
```

**Important:** The agent's tool set is **fixed at creation**. We can't dynamically add/remove tools from a running agent. Instead, we:

1. Pass ALL tools (active + wrapped deferred) at creation
2. Deferred tools check `activationManager.isActive()` before executing
3. Activation/deactivation just updates the Set
4. Next tool call checks the Set

**The model always sees all tool schemas**, but wrapped tools fail with helpful errors if not activated.

### Best Practices

1. **Register sparingly**: Only register tools you'll actually use
2. **Use examples**: Help semantic search find the right tool faster
3. **Deactivate when done**: Free up context for other tools
4. **Group related operations**: If you need 5 database tools, maybe create 1 database tool with actions
5. **Monitor context**: Log token usage to catch context bloat

## Summary

**Always provide when registering tools:**
1. ✅ Detailed parameter descriptions in Zod schema
2. ✅ Relevant tags for categorization
3. ✅ Representative examples showing typical usage
4. ✅ Clear, comprehensive description

**Manage tool lifecycle:**
- Search for tools when needed (parallel or sequential)
- Activate before use
- Deactivate when done to free context
- Consider auto-deactivation strategies for long-running agents

This enables accurate semantic search even with hundreds of similar tools while managing context window efficiently.
