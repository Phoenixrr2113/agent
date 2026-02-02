# Workflow Integration TODO - Unify Agent Factories

## Problem

`createAgent` and `createDurableAgent` are completely separate factories. The durable-agent has stubs that don't call the real agent. They should be unified.

---

## Current State

### Separate Factories

| Factory | File | Status |
|---------|------|--------|
| `createAgent` | `src/agent.ts` | ✅ Working, uses ToolLoopAgent |
| `createDurableAgent` | `src/workflow/durable-agent.ts` | ❌ Stub, doesn't call createAgent |

### Issues

1. `createDurableAgent` has its own `generate()` stub that doesn't use the real agent
2. No `durable: boolean` option in `createAgent`
3. Durable tools (`src/workflow/durable-tool.ts`) are not integrated
4. Workflow features (crash recovery, scheduling, approval) are not connected

---

## Files Impacted

### Primary Changes

| File | Change Required |
|------|-----------------|
| `src/agent.ts` | Add `durable?: boolean` option, integrate workflow wrapping |
| `src/workflow/durable-agent.ts` | Refactor to use `createAgent()` internally |
| `src/workflow/durable-tool.ts` | Integrate with agent tool building |
| `src/workflow/index.ts` | Update exports |
| `src/types/agent.ts` | Add durability options to `AgentOptions` |

### Secondary Changes

| File | Change Required |
|------|-----------------|
| `src/presets/tools.ts` | Optionally wrap tools as durable steps |
| `src/tools/provider.ts` | Add durable tool wrapper integration |
| `src/index.ts` | Ensure unified exports |

---

## Proposed Solution

### Option A: Unified Factory

```typescript
// src/agent.ts
export function createAgent(options: AgentOptions): Agent {
  const agent = buildBaseAgent(options);
  
  if (options.durable) {
    return wrapWithDurability(agent, options);
  }
  
  return agent;
}
```

### Option B: Durable Agent Wraps Base Agent

```typescript
// src/workflow/durable-agent.ts
export function createDurableAgent(options: AgentOptions): DurableAgent {
  const baseAgent = createAgent(options);
  
  return {
    ...baseAgent,
    durableGenerate: async (prompt) => {
      "use workflow";
      return baseAgent.generate({ prompt });
    },
    // ... other durable methods
  };
}
```

---

## New AgentOptions

```typescript
interface AgentOptions {
  // ... existing options
  
  // Durability options
  durable?: boolean;
  durabilityConfig?: {
    webhookBasePath?: string;
    retryCount?: number;
    timeout?: string;
  };
}
```

---

## Implementation Tasks

- [ ] 1. Add durability options to `src/types/agent.ts`
- [ ] 2. Update `createDurableAgent` to call `createAgent` internally
- [ ] 3. Integrate `wrapToolAsDurableStep` into tool building
- [ ] 4. Add `durable: boolean` option to `createAgent`
- [ ] 5. Connect workflow sleep/webhook to real workflow package
- [ ] 6. Add integration tests
- [ ] 7. Update documentation

---

## Dependencies

- [ ] useworkflow.dev integration (external)
- [ ] Workflow runtime availability check

---

## References

- `src/agent.ts` - Main agent factory
- `src/workflow/durable-agent.ts` - Durable agent (stub)
- `src/workflow/durable-tool.ts` - Durable tool wrappers
- `src/workflow/index.ts` - Workflow exports
- `src/types/agent.ts` - Agent options interface
- `src/presets/tools.ts` - Tool preset creation
- `src/tools/provider.ts` - Tool provider
