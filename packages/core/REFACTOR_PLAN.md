# Package Restructuring Plan (Final)

## Overview

This plan refactors `packages/core` to improve separation of concerns while maintaining cohesion and discoverability.

**Key Decisions:**
1. Extract `@agent/memory` for all information storage/retrieval
2. Keep all tools in `core/src/tools/` with minimal reorganization
3. Flatten redundant folder structure in core
4. Add `providers/` folder and `provider.ts` for tool creation

---

## 1. New Package: `@agent/memory`

Combines memory, profile, RAG, embeddings, and storage into one cohesive package.

### Source → Destination Mapping

| Source (core/src/core/) | Destination (memory/src/) |
|-------------------------|---------------------------|
| `memory/*` | `entities/` |
| `profile/*` | `profiles/` |
| `rag/*` | `codebase/` |
| `embeddings/*` | `embeddings/` |
| `memory/storage/*` | `storage/` |

### Final Structure

```
packages/memory/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── index.ts           # Public exports
    ├── embeddings.ts      # Embedding model factory
    ├── types.ts           # Shared types
    │
    ├── storage/           # Storage adapters (shared)
    │   ├── index.ts
    │   ├── types.ts
    │   ├── memory-adapter.ts
    │   └── sqlite-adapter.ts
    │
    ├── entities/          # Conversation memory (facts, entities, episodes)
    │   ├── index.ts
    │   ├── memory-lite.ts
    │   ├── extraction.ts
    │   ├── extractor.ts
    │   ├── factory.ts
    │   └── provider-*.ts
    │
    ├── profiles/          # User preference extraction
    │   ├── index.ts
    │   ├── manager.ts
    │   ├── extractor.ts
    │   ├── storage.ts
    │   └── types.ts
    │
    └── codebase/          # RAG for codebase indexing (optional)
        ├── index.ts
        ├── rag.ts
        ├── bm25.ts
        ├── cache.ts
        ├── chunking.ts
        ├── search-engine.ts
        ├── workspace-scanner.ts
        └── strategies/
```

### Dependencies

```json
{
  "name": "@agent/memory",
  "dependencies": {
    "@agent/shared": "workspace:*",
    "@openrouter/ai-sdk-provider": "^1.0.0",
    "ai": "6.0.0-beta.120",
    "better-sqlite3": "^12.4.6",
    "wink-bm25-text-search": "^3.1.2",
    "zod": "^3.25.76"
  }
}
```

---

## 2. Tools - Minimal Changes

Keep existing flat structure. Only changes:
1. Add `providers/` folder for wrapper tools
2. Add `provider.ts` for unified tool creation
3. Delete redundant re-export files
4. Move device/ to providers/

### Current vs Proposed

```
tools/
├── index.ts
├── provider.ts              # NEW: createAllTools()
│
├── providers/               # NEW: Wrappers for external packages
│   ├── memory.ts            # Renamed from memory-tool.ts
│   ├── codebase.ts          # Moved from tools/codebase.ts
│   └── device.ts            # Moved from device/index.ts
│
├── filesystem/              # KEEP AS-IS
├── registry/                # KEEP AS-IS
├── delegation/              # KEEP AS-IS
├── chaining/                # KEEP AS-IS
├── background-tasks/        # KEEP AS-IS
├── utils/                   # KEEP AS-IS
│
├── shell.ts                 # KEEP
├── web-tool.ts              # KEEP
├── plan.ts                  # RENAMED from workflow.ts
├── agent.ts                 # KEEP
├── lifecycle.ts             # Absorbs tool-instrumentation.ts
├── activation.ts            # RENAMED from tool-wrapper.ts
├── sequential-thinking.ts   # KEEP
├── factory.ts               # KEEP
│
├── *.test.ts                # Tests stay at root
│
├── filesystem.ts            # DELETE (redundant re-export)
├── registry.ts              # DELETE (redundant re-export)
├── device/                  # DELETE (moved to providers/)
└── (core/tool-instrumentation.ts) # DELETE (merged into lifecycle.ts)
```

**Note:** `core/profile/tool-wrapper.ts` moves to `@agent/memory/src/profiles/tool-wrapper.ts`

### Middleware Architecture

Two middleware layers for separation of concerns:

#### 1. Tool Middleware (`tools/middleware/`)

Opt-in middleware for tool execution:

```
tools/middleware/
├── index.ts           # applyToolMiddleware + types
├── activation.ts      # Deferred tool activation
├── instrumentation.ts # Timing/logging
├── reminders.ts       # Profile-based system messages
└── lifecycle.ts       # beforeExecute/afterExecute hooks
```

```typescript
// Usage
const tools = applyToolMiddleware(rawTools, [
  activationMiddleware,      // Opt-in
  instrumentationMiddleware, // Always on
  reminderMiddleware,        // Opt-in if profileManager provided
], { activationManager, profileManager, userId });
```

#### 2. Model Middleware (AI SDK) - FUTURE WORK

Use AI SDK's `wrapLanguageModel` for per-step concerns (deferred to separate task):

```typescript
import { wrapLanguageModel } from 'ai';

const wrappedModel = wrapLanguageModel({
  model: baseModel,
  middleware: [
    loggingMiddleware,      // Log each model call
    ragMiddleware,          // Inject codebase context
    guardrailsMiddleware,   // Content filtering
  ],
});
```

**Future use cases:**
- RAG context injection before each model call
- Caching model responses
- Per-step logging
- Safety guardrails

### provider.ts

```typescript
export interface ToolsConfig {
  workspaceRoot: string;
  memoryProvider?: MemoryProvider;
  codebaseRAG?: CodebaseRAG;
  askUserHandler?: AskUserHandler;
  disableAgentSpawning?: boolean;
}

export function createAllTools(config: ToolsConfig) {
  return {
    fs: createFsTool(config.workspaceRoot),
    shell: createShellTool(config.workspaceRoot),
    web: createWebTool(),
    memory: createMemoryTool(config.memoryProvider),
    codebase: config.codebaseRAG ? createCodebaseTool(config.codebaseRAG) : undefined,
    delegate: config.disableAgentSpawning ? undefined : createDelegateTool(config),
    task: createTaskTool(),
    plan: createPlanTool(config),
    ask_user: createAskUserTool(config.askUserHandler),
    task_complete: createTaskCompleteTool(),
    sequential_thinking: sequentialThinkingTool,
  };
}
```

---

## 3. Core Package Refactoring

### Flatten Structure

| Before | After |
|--------|-------|
| `src/core/agents/` | `src/agents/` |
| `src/core/tool-instrumentation.ts` | `src/tools/instrumentation.ts` |

### Remove (Moved to @agent/memory)

- `src/core/memory/`
- `src/core/profile/`
- `src/core/embeddings/`
- `src/core/rag/`

### Final Core Structure

```
packages/core/src/
├── index.ts
├── runtime/
├── application/
├── agents/           # Flattened from core/agents
├── infrastructure/
├── tools/
└── types/
```

---

## 4. Migration Steps

### Phase 1: Create @agent/memory
1. Create package scaffolding
2. Move entities, profiles, codebase, embeddings, storage
3. Build and test independently

### Phase 2: Clean Up Tools
1. Create `providers/` folder
2. Move memory-tool.ts → providers/memory.ts
3. Move codebase.ts → providers/codebase.ts
4. Move device/ → providers/device.ts
5. Create provider.ts
6. Delete filesystem.ts, registry.ts re-exports

### Phase 3: Flatten Core
1. Move src/core/agents/ → src/agents/
2. Delete empty src/core/
3. Update imports

### Phase 4: Verification
1. pnpm build
2. pnpm test
3. Test server and CLI

---

## 5. Dependency Graph

```
@agent/shared
    ↑
@agent/memory
    ↑
@agent/device-use
    ↑
@agent/core
    ↑
@agent/server, apps/cli, apps/expo
```
