# Prompts & Context - TODO

## Goal

Integrate user preferences from the memory layer into system context.

---

## Current State

`context.ts` accepts `userPreferences` as a parameter, but the caller must provide them manually.

## Future: Auto-Load from Memory

```typescript
// Proposed enhancement
const context = await buildSystemContext({
  workspaceRoot: '/my/project',
  memoryStore, // Pass memory store
  autoLoadPreferences: true, // Query memory for preferences
});
```

### Implementation

1. Query memory store for preference-related memories
2. Parse structured preferences from recall results
3. Merge with any explicitly provided preferences
4. Inject into system context

### Memory Integration

```typescript
async function loadPreferencesFromMemory(store: MemoryStore): Promise<UserPreferences> {
  const results = await store.recall('user preferences settings', { topK: 10 });
  
  // Parse structured preferences from memory
  // Could use LLM to extract, or store preferences in structured format
  
  return {
    name: extractName(results),
    communicationStyle: extractStyle(results),
    codeStyle: extractCodeStyle(results),
    // ...
  };
}
```

### Questions

1. How to distinguish user preferences from other memories?
   - Tag-based filtering (`tags: ['preference']`)
   - Dedicated preference store (separate from general memory)
   - Structured storage format

2. Should preferences be cached?
   - Reload on every session?
   - Cache with TTL?

3. How to handle conflicting preferences?
   - Explicit > Memory-loaded
   - Most recent wins

---

## Priority

- [ ] Memory store integration in context builder
- [ ] Tag-based preference filtering
- [ ] Preference extraction/parsing
- [ ] Caching strategy
