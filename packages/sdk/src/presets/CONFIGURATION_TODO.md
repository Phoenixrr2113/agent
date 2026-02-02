# Presets Configuration - TODO

## Goal

Allow developers to customize roles, sub-agent configs, and prompts via configuration instead of requiring code changes.

---

## Files to Update

### 1. `sub-agent-configs.ts`

Currently hardcoded sub-agent roles:
- `coder`, `researcher`, `analyst`, `generic`

**Need:**
- Allow registering custom sub-agent types
- Configurable tool presets per sub-agent role
- Custom system prompts per role

```typescript
// Proposed API
const sdk = createSDK({
  subAgents: {
    coder: { tools: ['filesystem', 'shell'], systemPrompt: '...' },
    myCustomRole: { tools: ['myTool'], systemPrompt: '...' },
  }
});
```

### 2. `roles.ts`

Currently hardcoded role configs:
- System prompts per role
- Recommended model tiers

**Need:**
- Allow overriding default system prompts
- Allow adding custom roles
- Support prompt templates with variables

```typescript
// Proposed API
const sdk = createSDK({
  roles: {
    coder: {
      systemPrompt: 'You are a coding assistant for {{projectName}}...',
      recommendedModel: 'powerful',
    },
    // Custom role
    debugger: {
      systemPrompt: 'You specialize in debugging {{language}} code...',
      recommendedModel: 'reasoning',
    },
  }
});
```

---

## Implementation Options

### Option A: Config File
```json
// agent-sdk.config.json
{
  "roles": { ... },
  "subAgents": { ... },
  "tools": { ... }
}
```

### Option B: SDK Factory Options
```typescript
import { createSDK } from '@agent/sdk';

const sdk = createSDK({
  roles: { /* custom roles */ },
  subAgents: { /* custom configs */ },
});
```

### Option C: Environment Variables
```bash
AGENT_SDK_CONFIG_PATH=./my-config.json
```

---

## Questions

1. Should custom roles completely replace defaults or merge with them?
2. How to handle prompt template variables?
3. Should we support async config loading (from remote)?

---

## Priority

- [ ] Sub-agent config customization
- [ ] Role/prompt customization
- [ ] Prompt template variables
- [ ] Config file support
