# Tool Registration Guide

This guide explains how to register tools with rich metadata to enable effective semantic search and discovery.

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
search_tools({ query: "fetch customer details" })
// ✅ Finds: get_user_profile (tags: user, profile, read)

// Agent needs: "modify account information"
search_tools({ query: "modify account information" })
// ✅ Finds: update_user_profile (tags: user, profile, write)

// Agent needs: "permanently remove account"
search_tools({ query: "permanently remove account" })
// ✅ Finds: delete_user_account (tags: account, delete, destructive)
```

## Summary

**Always provide when registering tools:**
1. ✅ Detailed parameter descriptions in Zod schema
2. ✅ Relevant tags for categorization
3. ✅ Representative examples showing typical usage
4. ✅ Clear, comprehensive description

This enables accurate semantic search even with hundreds of similar tools.
